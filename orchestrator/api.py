from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from scheduler import Scheduler, DownloadJob, Priority
from config import AppConfig, load_config, save_config
from pathlib import Path

app = FastAPI(title="Yank API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = Path.home() / ".config" / "yank" / "config.json"
config = load_config(CONFIG_PATH)
scheduler = Scheduler(max_concurrent=config.max_concurrent_downloads)


class AddDownloadRequest(BaseModel):
    url: str
    filename: Optional[str] = ""
    priority: Optional[str] = "normal"


class ConfigUpdate(BaseModel):
    default_download_dir: Optional[str] = None
    max_connections_per_file: Optional[int] = None
    max_concurrent_downloads: Optional[int] = None
    speed_limit_kbps: Optional[int] = None


def priority_from_str(s: str) -> Priority:
    mapping = {"high": Priority.HIGH, "normal": Priority.NORMAL, "low": Priority.LOW}
    return mapping.get(s.lower(), Priority.NORMAL)


def job_to_dict(job: DownloadJob) -> dict:
    return {
        "id": job.job_id,
        "url": job.url,
        "filename": job.filename,
        "status": job.status.value,
        "priority": job.priority.name.lower(),
        "progress": job.progress_percent,
        "speed_bps": job.speed_bps,
        "eta_seconds": job.eta_seconds,
        "total_bytes": job.total_bytes,
        "downloaded_bytes": job.downloaded_bytes,
        "created_at": job.created_at.isoformat(),
        "error": job.error,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/downloads", status_code=201)
async def add_download(req: AddDownloadRequest):
    filename = req.filename or req.url.split("/")[-1] or "download"
    job = DownloadJob(
        url=req.url,
        filename=filename,
        priority=priority_from_str(req.priority or "normal"),
    )
    job_id = scheduler.add(job)
    return {"id": job_id, "status": "queued"}


@app.get("/downloads")
async def list_downloads():
    jobs = scheduler.get_all()
    return {"downloads": [job_to_dict(j) for j in jobs]}


@app.get("/downloads/{job_id}")
async def get_download(job_id: str):
    job = scheduler.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download not found")
    return job_to_dict(job)


@app.post("/downloads/{job_id}/pause")
async def pause_download(job_id: str):
    if not scheduler.pause(job_id):
        raise HTTPException(status_code=404, detail="Download not found or not active")
    return {"status": "paused"}


@app.post("/downloads/{job_id}/resume")
async def resume_download(job_id: str):
    if not scheduler.resume(job_id):
        raise HTTPException(status_code=404, detail="Download not found or not paused")
    return {"status": "queued"}


@app.delete("/downloads/{job_id}")
async def cancel_download(job_id: str):
    if not scheduler.cancel(job_id):
        raise HTTPException(status_code=404, detail="Download not found")
    return {"status": "cancelled"}


@app.get("/config")
async def get_config():
    return config.model_dump(mode="json")


@app.patch("/config")
async def update_config(update: ConfigUpdate):
    global config
    data = config.model_dump(mode="json")
    patch = update.model_dump(exclude_none=True)
    data.update(patch)
    config = AppConfig(**data)
    save_config(config, CONFIG_PATH)
    return config.model_dump(mode="json")
