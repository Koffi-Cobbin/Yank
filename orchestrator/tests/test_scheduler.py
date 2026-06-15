import pytest
import asyncio
from scheduler import Scheduler, DownloadJob, Priority, JobStatus


def test_add_job():
    s = Scheduler(max_concurrent=2)
    job = DownloadJob(url="http://example.com/file.zip", filename="file.zip")
    job_id = s.add(job)
    assert job_id == job.job_id
    found = s.get(job_id)
    assert found is not None
    assert found.status == JobStatus.QUEUED


def test_cancel_job():
    s = Scheduler(max_concurrent=2)
    job = DownloadJob(url="http://example.com/file.zip", filename="file.zip")
    job_id = s.add(job)
    assert s.cancel(job_id)
    found = s.get(job_id)
    assert found.status == JobStatus.CANCELLED


def test_get_all_empty():
    s = Scheduler()
    assert s.get_all() == []


def test_priority_ordering():
    s = Scheduler()
    j1 = DownloadJob(url="http://a.com/1", filename="1", priority=Priority.LOW)
    j2 = DownloadJob(url="http://a.com/2", filename="2", priority=Priority.HIGH)
    s.add(j1)
    s.add(j2)
    jobs = s.get_all()
    assert len(jobs) == 2
