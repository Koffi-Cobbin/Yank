import asyncio
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
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
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
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

    async def _execute_job(self, job: DownloadJob) -> None:
        try:
            await asyncio.sleep(0)
            job.status = JobStatus.COMPLETE
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)
        finally:
            async with self._lock:
                self._active.pop(job.job_id, None)
                self._completed[job.job_id] = job
