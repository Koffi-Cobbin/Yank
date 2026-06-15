from pydantic import BaseModel
from pathlib import Path
import json


class AppConfig(BaseModel):
    default_download_dir: Path = Path.home() / "Downloads"
    max_connections_per_file: int = 16
    max_concurrent_downloads: int = 3
    speed_limit_kbps: int = 0
    scheduled_hours: list[tuple[int, int]] = []
    engine_port: int = 6800
    api_port: int = 6801


def load_config(path: Path) -> AppConfig:
    if path.exists():
        with open(path) as f:
            data = json.load(f)
        return AppConfig(**data)
    return AppConfig()


def save_config(config: AppConfig, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(config.model_dump(mode="json"), f, indent=2, default=str)
