from typing import Optional
import subprocess
import json


def extract_video_info(url: str) -> dict:
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title", ""),
                "url": url,
                "formats": [
                    {
                        "format_id": f.get("format_id"),
                        "ext": f.get("ext"),
                        "resolution": f.get("resolution") or f"{f.get('height', '?')}p",
                        "filesize": f.get("filesize"),
                    }
                    for f in info.get("formats", [])
                    if f.get("vcodec") != "none"
                ],
                "thumbnail": info.get("thumbnail", ""),
                "duration": info.get("duration", 0),
            }
    except Exception as e:
        return {"error": str(e), "url": url}


def download_video(url: str, output_dir: str, quality: str = "best") -> Optional[str]:
    try:
        import yt_dlp

        format_spec = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        if quality == "720p":
            format_spec = "bestvideo[height<=720]+bestaudio/best[height<=720]"
        elif quality == "480p":
            format_spec = "bestvideo[height<=480]+bestaudio/best[height<=480]"

        opts = {
            "quiet": False,
            "format": format_spec,
            "outtmpl": f"{output_dir}/%(title)s.%(ext)s",
            "merge_output_format": "mp4",
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return ydl.prepare_filename(info)
    except Exception as e:
        print(f"download_video error: {e}")
        return None
