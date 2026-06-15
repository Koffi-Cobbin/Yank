import asyncio
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional


class Priority(Enum):
    HIGH = 1
    NORMAL = 2
    LOW = 3


class JobStatus(Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PAUSED = "paused"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


VIDEO_HOSTS = [
    "youtube.com", "youtu.be", "vimeo.com", "dailymotion.com",
    "twitch.tv", "tiktok.com", "instagram.com", "twitter.com",
    "x.com", "reddit.com", "facebook.com",
]


@dataclass
class DownloadJob:
    url: str
    filename: str
    priority: Priority = Priority.NORMAL
    scheduled_time: Optional[datetime] = None
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: JobStatus = JobStatus.QUEUED
    progress_percent: float = 0.0
    speed_bps: float = 0.0
    eta_seconds: float = 0.0
    total_bytes: int = 0
    downloaded_bytes: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


class Scheduler:
    def __init__(self, max_concurrent: int = 3, download_dir: Optional[Path] = None):
        self.max_concurrent = max_concurrent
        self.download_dir = download_dir or (Path.home() / "Downloads")
        self._queue: deque[DownloadJob] = deque()
        self._active: dict[str, DownloadJob] = {}
        self._completed: dict[str, DownloadJob] = {}
        self._lock = asyncio.Lock()

    def add(self, job: DownloadJob) -> str:
        self._queue.append(job)
        return job.job_id

    def get_all(self) -> list[DownloadJob]:
        jobs = list(self._queue) + list(self._active.values()) + list(self._completed.values())
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)

    def get(self, job_id: str) -> Optional[DownloadJob]:
        for job in self._queue:
            if job.job_id == job_id:
                return job
        return self._active.get(job_id) or self._completed.get(job_id)

    def pause(self, job_id: str) -> bool:
        job = self._active.get(job_id)
        if job:
            job.status = JobStatus.PAUSED
            return True
        return False

    def resume(self, job_id: str) -> bool:
        job = self.get(job_id)
        if job and job.status == JobStatus.PAUSED:
            job.status = JobStatus.QUEUED
            if job_id in self._active:
                del self._active[job_id]
            self._queue.appendleft(job)
            return True
        return False

    def cancel(self, job_id: str) -> bool:
        job = self.get(job_id)
        if job:
            job.status = JobStatus.CANCELLED
            self._active.pop(job_id, None)
            self._completed[job_id] = job
            self._queue = deque(j for j in self._queue if j.job_id != job_id)
            return True
        return False

    def remove(self, job_id: str) -> bool:
        job = self.get(job_id)
        if not job:
            return False
        self._active.pop(job_id, None)
        self._completed.pop(job_id, None)
        self._queue = deque(j for j in self._queue if j.job_id != job_id)
        return True

    def update(self, job_id: str, filename: Optional[str] = None, priority: Optional[Priority] = None) -> bool:
        job = self.get(job_id)
        if not job:
            return False
        if filename is not None:
            job.filename = filename
        if priority is not None:
            job.priority = priority
        return True

    def retry(self, job_id: str) -> Optional[str]:
        job = self.get(job_id)
        if not job or job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
            return None
        new_job = DownloadJob(
            url=job.url,
            filename=job.filename,
            priority=job.priority,
        )
        self._completed.pop(job_id, None)
        return self.add(new_job)

    async def run(self) -> None:
        while True:
            async with self._lock:
                while len(self._active) < self.max_concurrent and self._queue:
                    job = self._queue.popleft()
                    if job.status == JobStatus.QUEUED:
                        job.status = JobStatus.DOWNLOADING
                        self._active[job.job_id] = job
                        asyncio.create_task(self._execute_job(job))
            await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # Download execution
    # ------------------------------------------------------------------

    def _is_video_url(self, url: str) -> bool:
        return any(h in url for h in VIDEO_HOSTS)

    async def _execute_job(self, job: DownloadJob) -> None:
        try:
            self.download_dir.mkdir(parents=True, exist_ok=True)
            if self._is_video_url(job.url):
                await self._download_video(job)
            else:
                await self._download_http(job)

            if job.status not in (JobStatus.PAUSED, JobStatus.CANCELLED):
                job.status = JobStatus.COMPLETE
                job.progress_percent = 100.0

        except asyncio.CancelledError:
            job.status = JobStatus.PAUSED
        except Exception as e:
            if job.status not in (JobStatus.PAUSED, JobStatus.CANCELLED):
                job.status = JobStatus.FAILED
                job.error = str(e)
        finally:
            async with self._lock:
                self._active.pop(job.job_id, None)
                self._completed[job.job_id] = job

    async def _download_video(self, job: DownloadJob) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._run_ytdlp, job)

    def _run_ytdlp(self, job: DownloadJob) -> None:
        import yt_dlp

        def progress_hook(d: dict) -> None:
            if job.status in (JobStatus.PAUSED, JobStatus.CANCELLED):
                raise yt_dlp.utils.DownloadCancelled()

            if d["status"] == "downloading":
                downloaded = d.get("downloaded_bytes") or 0
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                speed = d.get("speed") or 0.0
                eta = d.get("eta") or 0.0
                job.downloaded_bytes = downloaded
                job.total_bytes = total
                job.speed_bps = speed
                job.eta_seconds = eta
                if total > 0:
                    job.progress_percent = round((downloaded / total) * 100, 2)

            elif d["status"] == "finished":
                job.downloaded_bytes = job.total_bytes
                job.progress_percent = 100.0
                job.speed_bps = 0.0
                job.eta_seconds = 0.0

        opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": str(self.download_dir / "%(title)s.%(ext)s"),
            "progress_hooks": [progress_hook],
            "merge_output_format": "mp4",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": False,
        }

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(job.url, download=True)
            if info:
                final_name = ydl.prepare_filename(info)
                job.filename = Path(final_name).name

    async def _download_http(self, job: DownloadJob) -> None:
        import aiohttp

        output_path = self.download_dir / job.filename
        chunk_size = 65536  # 64 KB

        async with aiohttp.ClientSession() as session:
            async with session.get(job.url, allow_redirects=True) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("Content-Length", 0))
                job.total_bytes = total
                downloaded = 0
                import time
                start_time = time.monotonic()

                with open(output_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(chunk_size):
                        if job.status in (JobStatus.PAUSED, JobStatus.CANCELLED):
                            return
                        f.write(chunk)
                        downloaded += len(chunk)
                        job.downloaded_bytes = downloaded
                        elapsed = time.monotonic() - start_time
                        if elapsed > 0:
                            job.speed_bps = downloaded / elapsed
                        if total > 0:
                            job.progress_percent = round((downloaded / total) * 100, 2)
                            remaining = total - downloaded
                            if job.speed_bps > 0:
                                job.eta_seconds = remaining / job.speed_bps
