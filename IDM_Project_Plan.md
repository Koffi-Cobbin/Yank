# Building Yank — A High-Performance Internet Download Manager
> **Tech Stack:** C++ (Core Engine) · Python (Tooling & Scripting) · JavaScript (Browser Extension & GUI)
> **Goal:** Performance comparable to IDM / Free Download Manager

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1 — Environment Setup](#phase-1--environment-setup-week-1)
3. [Phase 2 — Core Download Engine (C++)](#phase-2--core-download-engine-c-weeks-2-6)
4. [Phase 3 — Python Tooling Layer](#phase-3--python-tooling-layer-weeks-5-7)
5. [Phase 4 — Browser Extension (JavaScript)](#phase-4--browser-extension-javascript-weeks-6-8)
6. [Phase 5 — Desktop GUI (JavaScript/Electron)](#phase-5--desktop-gui-javascriptelectron-weeks-8-12)
7. [Phase 6 — Advanced Features](#phase-6--advanced-features-weeks-12-16)
8. [Phase 7 — Testing & Distribution](#phase-7--testing--distribution-weeks-15-18)
9. [Tech Stack Justification](#tech-stack-justification)
10. [Project Folder Structure](#project-folder-structure)
11. [Key Dependencies](#key-dependencies)
12. [Performance Targets](#performance-targets)

---

## Architecture Overview

The system is split into three tightly integrated layers:

```
┌────────────────────────────────────────────────────────┐
│           PRESENTATION LAYER (JavaScript)              │
│   Electron GUI  ←→  Browser Extension (Chrome/FF)     │
└──────────────────────┬─────────────────────────────────┘
                       │ IPC / REST (localhost)
┌──────────────────────▼─────────────────────────────────┐
│           ORCHESTRATION LAYER (Python)                 │
│   Config Manager · Scheduler · Plugin System           │
└──────────────────────┬─────────────────────────────────┘
                       │ C bindings / subprocess
┌──────────────────────▼─────────────────────────────────┐
│           CORE ENGINE LAYER (C++)                      │
│   HTTP Client · Chunk Manager · Thread Pool            │
│   Resume Manager · File Assembler · Speed Limiter      │
└────────────────────────────────────────────────────────┘
```

**Why this layering?**
- C++ handles all performance-critical I/O work (raw speed, memory control, true multi-threading)
- Python orchestrates scheduling, config, plugins, and glues systems together
- JavaScript drives the UI and browser integration (cross-platform, rapid UI iteration)

---

## Phase 1 — Environment Setup (Week 1)

### Goals
Get the full development environment ready before writing production code.

### Tasks

**1.1 — Install Core Build Tools**
- Install `CMake` (3.20+) and a C++ compiler (`g++` on Linux/macOS, `MSVC` or `MinGW` on Windows)
- Install `vcpkg` (C++ package manager) for dependency management
- Install `Python 3.11+` and `pip`
- Install `Node.js 20 LTS` and `npm`

**1.2 — Set Up Version Control**
```
git init yank
cd yank
git submodule add https://github.com/microsoft/vcpkg
```

**1.3 — Configure CMake Project**
- Create a root `CMakeLists.txt` that builds the C++ core engine as a shared library (`.dll` / `.so`)
- Enable C++20 features (coroutines, `std::jthread`, `std::span`)

**1.4 — Set Up Python Venv**
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install requests aiohttp fastapi uvicorn pydantic
```

**1.5 — Set Up JavaScript Workspace**
```bash
npm init -y
npm install electron electron-builder vite react react-dom
```

**1.6 — Set Up Linting & Formatting**
- C++: `clang-format` + `clang-tidy`
- Python: `ruff` + `mypy`
- JavaScript: `ESLint` + `Prettier`

---

## Phase 2 — Core Download Engine (C++) (Weeks 2–6)

This is the most critical phase. Every performance gain starts here.

### 2.1 — HTTP Client with Range Request Support (Week 2)

**Library:** Use `libcurl` (via vcpkg) — battle-tested, supports HTTP/1.1, HTTP/2, HTTPS, proxies, cookies, and redirects out of the box.

**Key implementation steps:**
1. Send a `HEAD` request to the URL first
2. Parse `Content-Length` and check for `Accept-Ranges: bytes` header
3. If range requests are supported → proceed to multi-chunk download
4. If not → fall back to single-threaded download

```cpp
// Example: Check server capabilities
struct ServerInfo {
    size_t contentLength;
    bool acceptsRanges;
    std::string mimeType;
    std::string filename;  // from Content-Disposition header
};

ServerInfo probeServer(const std::string& url);
```

**Handle edge cases:**
- 301/302 redirects (follow up to 10 hops)
- HTTPS with self-signed certs (configurable)
- Servers that lie about `Accept-Ranges`
- `Content-Disposition` filename parsing

---

### 2.2 — Chunk Splitter & Multi-threaded Downloader (Weeks 2–3)

**Core concept:** Split the file into N equal-sized byte ranges and download each in a separate thread simultaneously.

**Optimal chunk count:** 8–16 connections (default 16, user-configurable). More connections do not always mean higher speed — some servers throttle per-connection.

```cpp
struct Chunk {
    size_t id;
    size_t byteStart;
    size_t byteEnd;
    size_t bytesDownloaded;
    ChunkStatus status;  // PENDING, DOWNLOADING, PAUSED, DONE, FAILED
    std::filesystem::path tempFilePath;
};

std::vector<Chunk> splitFile(size_t totalSize, int numChunks);
```

**Thread pool implementation:**
- Use `std::jthread` (C++20) for safe, auto-joining threads
- Implement a fixed-size thread pool (avoid spawning/destroying threads per chunk)
- Each worker thread picks a chunk from the queue, downloads it to a `.part` temp file

```cpp
class ThreadPool {
public:
    explicit ThreadPool(size_t numThreads);
    void enqueue(std::function<void()> task);
    void waitAll();
private:
    std::vector<std::jthread> workers;
    std::queue<std::function<void()>> taskQueue;
    std::mutex mutex;
    std::condition_variable cv;
};
```

**Dynamic chunk rebalancing:**
- If a chunk fails, split it into two smaller chunks and retry
- If a slow chunk is lagging far behind others, steal half its remaining bytes and assign to an idle thread

---

### 2.3 — Resume Manager (Week 3)

**Critical for production quality.** Users must be able to pause and resume without restarting.

**Implementation:**
1. For each download, create a `.yank` metadata file alongside the temp chunks:
```json
{
  "url": "https://...",
  "totalSize": 104857600,
  "filename": "ubuntu.iso",
  "chunks": [
    { "id": 0, "byteStart": 0, "byteEnd": 13107200, "bytesDownloaded": 13107200, "status": "DONE" },
    { "id": 1, "byteStart": 13107201, "byteEnd": 26214400, "bytesDownloaded": 5000000, "status": "PAUSED" }
  ]
}
```
2. On resume, read the metadata, skip completed chunks, and restart incomplete ones from their last byte position
3. Validate resumed chunks with checksums (SHA-256 per chunk)
4. Handle URL expiry: detect `403 Forbidden` on resume and prompt user to refresh the URL

---

### 2.4 — File Assembler (Week 4)

After all chunks are downloaded, merge them into the final file **in order**.

```cpp
void assembleFile(
    const std::vector<Chunk>& chunks,
    const std::filesystem::path& outputPath
);
```

**Performance tip:** Use memory-mapped files (`mmap` on Linux/macOS, `CreateFileMapping` on Windows) instead of reading all chunks into RAM. This lets the OS handle I/O buffering efficiently and avoids copying gigabytes through user-space buffers.

**Post-assembly:**
- Delete all `.part` temp files and the `.yank` metadata file
- Optionally compute SHA-256/MD5 of the final file and compare against a provided hash

---

### 2.5 — Speed Controller & Bandwidth Limiter (Week 4)

```cpp
class SpeedLimiter {
public:
    explicit SpeedLimiter(size_t maxBytesPerSec);  // 0 = unlimited
    void throttle(size_t bytesJustWritten);
private:
    size_t limit;
    std::chrono::steady_clock::time_point windowStart;
    size_t bytesInWindow;
};
```

**Real-time speed measurement:**
- Track bytes downloaded in 1-second sliding windows
- Calculate current speed as a rolling average over 5 windows
- Estimate ETA = `(totalSize - bytesDownloaded) / averageSpeed`

---

### 2.6 — IPC Server (Week 5–6)

The C++ engine must communicate with Python and JavaScript layers. Expose it via:

**Option A (Recommended): Embedded HTTP server**
- Use `cpp-httplib` (header-only) to expose a REST API on `localhost:6800`
- Endpoints: `POST /download`, `GET /status/{id}`, `POST /pause/{id}`, `DELETE /cancel/{id}`

**Option B: Shared library with Python bindings**
- Compile core as a `.so`/`.dll` and expose a C API
- Call from Python using `ctypes` or `cffi`
- Better performance (no serialization overhead), more complex to maintain

**Recommended:** Use Option A for Phase 2, optionally migrate to Option B in Phase 6 for maximum performance.

---

## Phase 3 — Python Tooling Layer (Weeks 5–7)

Python sits between the C++ engine and the GUI, handling configuration, scheduling, and plugins.

### 3.1 — Configuration Manager (Week 5)

```python
# config.py
from pydantic import BaseModel
from pathlib import Path
import json

class AppConfig(BaseModel):
    default_download_dir: Path = Path.home() / "Downloads"
    max_connections_per_file: int = 16
    max_concurrent_downloads: int = 3
    speed_limit_kbps: int = 0  # 0 = unlimited
    scheduled_hours: list[tuple[int, int]] = []  # e.g., [(22, 0), (6, 0)] = 10pm to 6am

def load_config(path: Path) -> AppConfig: ...
def save_config(config: AppConfig, path: Path) -> None: ...
```

### 3.2 — Download Scheduler (Week 6)

```python
# scheduler.py
import asyncio
from collections import deque
from dataclasses import dataclass
from enum import Enum

class Priority(Enum):
    HIGH = 1
    NORMAL = 2
    LOW = 3

@dataclass
class DownloadJob:
    url: str
    filename: str
    priority: Priority
    scheduled_time: datetime | None

class Scheduler:
    def __init__(self, max_concurrent: int): ...
    def add(self, job: DownloadJob) -> str: ...  # returns job_id
    def pause(self, job_id: str) -> None: ...
    def resume(self, job_id: str) -> None: ...
    def cancel(self, job_id: str) -> None: ...
    async def run(self) -> None: ...  # main event loop
```

### 3.3 — REST API Bridge (Week 6–7)

Use `FastAPI` + `uvicorn` to expose a local REST server that the Electron GUI and browser extension communicate with.

```python
# api.py
from fastapi import FastAPI
app = FastAPI()

@app.post("/downloads")
async def add_download(url: str, filename: str = "", priority: str = "normal"): ...

@app.get("/downloads")
async def list_downloads(): ...

@app.get("/downloads/{job_id}/status")
async def get_status(job_id: str): ...

@app.post("/downloads/{job_id}/pause")
async def pause_download(job_id: str): ...

@app.delete("/downloads/{job_id}")
async def cancel_download(job_id: str): ...
```

### 3.4 — Video URL Detector (Week 7)

Wrap `yt-dlp` as a Python library to support video downloads from YouTube, Vimeo, etc.

```python
import yt_dlp

def extract_video_info(url: str) -> dict:
    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        return ydl.extract_info(url, download=False)

def download_video(url: str, output_dir: str, quality: str = "best") -> None: ...
```

---

## Phase 4 — Browser Extension (JavaScript) (Weeks 6–8)

Intercept downloads in Chrome/Firefox and hand them off to Yank.

### 4.1 — Extension Architecture

```
extension/
├── manifest.json          # Extension manifest (v3 for Chrome, v2 for Firefox)
├── background/
│   └── service_worker.js  # Intercepts downloads, sends to local API
├── popup/
│   ├── popup.html
│   └── popup.js           # Small UI to toggle extension on/off
└── icons/
```

### 4.2 — Download Interception (Chrome MV3)

```javascript
// background/service_worker.js

// Intercept all download attempts
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!extensionEnabled) return;

  // Cancel the browser's own download
  chrome.downloads.cancel(downloadItem.id);
  chrome.downloads.erase({ id: downloadItem.id });

  // Hand off to Yank via local API
  await fetch("http://localhost:6800/downloads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: downloadItem.url,
      filename: downloadItem.filename,
      referrer: downloadItem.referrer,
    }),
  });
});
```

### 4.3 — Cookie & Header Forwarding

Many downloads require authentication cookies. Capture and forward them:

```javascript
// Get cookies for the download URL
async function getCookiesForUrl(url) {
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}
```

### 4.4 — Video Grabber Overlay

Inject a content script that detects `<video>` elements on pages and shows a download button:

```javascript
// content_scripts/video_detector.js
document.querySelectorAll("video source").forEach(source => {
  if (source.src) injectDownloadButton(source.src);
});
```

- **Browser extension:** *Yank for Chrome / Yank for Firefox* — listed on Chrome Web Store and Firefox Add-ons

### 4.5 — Firefox Compatibility

Create a `manifest.v2.json` variant for Firefox (Firefox uses Manifest V2). Use `webextension-polyfill` to abstract API differences.

---

## Phase 5 — Desktop GUI (JavaScript/Electron) (Weeks 8–12)

### 5.1 — App Architecture

```
gui/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge (contextBridge)
├── src/
│   ├── App.jsx          # Root React component
│   ├── components/
│   │   ├── DownloadList.jsx      # Main download queue table
│   │   ├── DownloadItem.jsx      # Single row with progress bar
│   │   ├── AddDownloadModal.jsx  # Paste URL dialog
│   │   ├── SettingsPanel.jsx     # Config UI
│   │   └── SpeedGraph.jsx        # Real-time speed chart
│   └── hooks/
│       └── useDownloads.js       # Polling hook for /downloads endpoint
└── vite.config.js
```

### 5.2 — Core UI Features

**Download List Table columns:**
- Filename + icon (by extension)
- Size (total)
- Downloaded (progress %)
- Speed (real-time, e.g. "12.4 MB/s")
- ETA
- Status badge (Downloading / Paused / Complete / Error)
- Actions (Pause, Resume, Cancel, Open Folder)

**Progress bar:** Use a segmented bar that shows per-chunk progress visually (like IDM's colored chunks — Yank's signature visual).

**System tray integration:**
```javascript
// main.js
const { Tray, Menu } = require("electron");
const tray = new Tray("icon.png");
tray.setContextMenu(Menu.buildFromTemplate([
  { label: "Open Yank", click: () => win.show() },
  { label: "Pause All", click: () => pauseAll() },
  { label: "Quit", role: "quit" }
]));
```

### 5.3 — Real-time Speed Graph

Use `Chart.js` or `Recharts` to plot download speed over time (sliding 60-second window). Poll `/downloads` every 500ms and update chart data.

### 5.4 — Drag & Drop URL Support

```javascript
document.addEventListener("drop", (e) => {
  const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  if (url.startsWith("http")) openAddDownloadDialog(url);
});
```

### 5.5 — Settings Screen

| Setting | Type | Default |
|---|---|---|
| Default download folder | Path picker | `~/Downloads` |
| Max simultaneous downloads | Slider 1–10 | 3 |
| Connections per file | Slider 1–32 | 16 |
| Speed limit | Number input (KB/s) | 0 (unlimited) |
| Schedule downloads | Time range picker | Off |
| Dark / Light mode | Toggle | System default |
| Auto-start on login | Checkbox | Off |

### 5.6 — Build & Package

Use `electron-builder` to package for all platforms:
```json
{
  "build": {
    "appId": "com.yourname.yank",
    "mac": { "target": "dmg" },
    "win": { "target": "nsis" },
    "linux": { "target": ["AppImage", "deb"] }
  }
}
```

---

## Phase 6 — Advanced Features (Weeks 12–16)

### 6.1 — HTTP/2 & HTTP/3 Support

Upgrade `libcurl` to use HTTP/2 multiplexing. HTTP/2 allows multiple streams over a single TCP connection, which is more efficient and bypasses per-connection limits some servers impose.

- Configure curl: `curl_easy_setopt(handle, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2TLS)`
- For HTTP/3 (QUIC): Use `libcurl` built with `quiche` or `ngtcp2` backend

### 6.2 — Smart Chunk Rebalancer

Track per-chunk speed. If one chunk is downloading much slower (perhaps due to server-side routing), steal half its remaining range and assign it to a faster connection.

```cpp
void rebalanceSlowChunks(std::vector<Chunk>& chunks, double slowThresholdMultiplier = 0.3);
```

### 6.3 — Batch Download

- Accept `.txt` file with one URL per line
- Parse web pages for all links matching a pattern (e.g., all `.mp4` links on a page)
- Schedule all as a batch with sequential or parallel execution

### 6.4 — Torrent Support

Integrate `libtorrent` (C++) for `.torrent` files and magnet links:
```cpp
#include <libtorrent/session.hpp>
lt::session session;
lt::add_torrent_params params;
params.save_path = "./downloads";
session.add_torrent(params);
```

### 6.5 — Post-download Actions

- Auto-open file after download
- Run a custom script/command on completion
- Send OS notification
- Auto-extract `.zip`/`.tar.gz` archives (Python: `zipfile`, `tarfile`)
- Virus scan via Windows Defender / ClamAV integration

### 6.6 — Cloud Sync (Optional)

Sync download history and settings via a simple JSON file stored in Dropbox / Google Drive:
- Use `watchdog` (Python) to detect changes to the sync file
- Merge histories using `job_id` as deduplication key

---

## Phase 7 — Testing & Distribution (Weeks 15–18)

### 7.1 — Unit Tests

- **C++:** Use `Google Test` (gtest) to test chunk splitting, resume manager, file assembler, speed limiter
- **Python:** Use `pytest` to test scheduler logic, config loading, API endpoints
- **JavaScript:** Use `Vitest` to test utility functions and React components

### 7.2 — Integration Tests

- Spin up a local HTTP test server (Python's `http.server`) with large test files
- Test: download → pause → kill process → restart → resume → verify file integrity with SHA-256
- Test with server that doesn't support range requests (single-thread fallback)
- Test concurrent downloads reaching the limit

### 7.3 — Performance Benchmarking

Compare Yank against Free Download Manager on the same file/server:

| Metric | Target |
|---|---|
| Download speed vs single-thread | ≥ 3–5× faster |
| RAM usage (1 active download) | < 50 MB |
| CPU usage during download | < 5% (single core) |
| Time to assemble a 1 GB file | < 2 seconds |
| Chunk count sweet spot | 16 connections |

### 7.4 — Edge Case Testing

- File size = 0 bytes
- Server returns wrong `Content-Length`
- Network drops mid-download (simulate with `tc netem` on Linux)
- Disk runs out of space mid-download
- URL expires during download (session token in URL)
- Filename contains invalid characters for the OS

### 7.5 — Distribution

| Platform | Format | Tool |
|---|---|---|
| Windows | `.exe` NSIS installer | `electron-builder` |
| macOS | `.dmg` disk image | `electron-builder` |
| Linux | `.AppImage` + `.deb` | `electron-builder` |
| Chrome Web Store | `.crx` extension | Chrome Developer Console |
| Firefox Add-ons | `.xpi` extension | Firefox Developer Hub |

---

## Tech Stack Justification

| Layer | Technology | Why |
|---|---|---|
| Download Engine | **C++20** | Maximum performance, true multi-threading, direct memory/I/O control, no GC pauses |
| HTTP Client | **libcurl** | Industry standard, handles HTTP/2, HTTPS, cookies, redirects, proxies — battle-tested |
| Concurrency | **std::jthread + ThreadPool** | C++20 safe threads, no external dependency |
| Orchestration | **Python 3.11+** | Fast scripting for scheduling, config, plugin logic; `asyncio` for async I/O |
| API Bridge | **FastAPI + uvicorn** | Modern, async, auto-generates OpenAPI docs |
| Browser Extension | **JavaScript (WebExtensions API)** | Only option for cross-browser extension support |
| Desktop GUI | **Electron + React** | Cross-platform, uses your existing JS skills, rich ecosystem |
| Build System | **CMake + vcpkg** | Industry standard C++ build tooling |

---

## Project Folder Structure

```
yank/
├── engine/                        # C++ core engine
│   ├── CMakeLists.txt
│   ├── include/
│   │   ├── downloader.hpp
│   │   ├── chunk_manager.hpp
│   │   ├── resume_manager.hpp
│   │   └── http_server.hpp
│   ├── src/
│   │   ├── main.cpp
│   │   ├── downloader.cpp
│   │   ├── chunk_manager.cpp
│   │   ├── resume_manager.cpp
│   │   ├── file_assembler.cpp
│   │   ├── speed_limiter.cpp
│   │   └── http_server.cpp
│   └── tests/
│       └── test_chunk_manager.cpp
│
├── orchestrator/                  # Python middle layer
│   ├── main.py
│   ├── api.py
│   ├── scheduler.py
│   ├── config.py
│   ├── video_grabber.py
│   ├── requirements.txt
│   └── tests/
│       └── test_scheduler.py
│
├── extension/                     # Browser extension
│   ├── manifest.json              # Chrome MV3
│   ├── manifest.v2.json           # Firefox MV2
│   ├── background/
│   │   └── service_worker.js
│   ├── content_scripts/
│   │   └── video_detector.js
│   └── popup/
│       ├── popup.html
│       └── popup.js
│
├── gui/                           # Electron + React app
│   ├── package.json
│   ├── vite.config.js
│   ├── main.js
│   ├── preload.js
│   └── src/
│       ├── App.jsx
│       └── components/
│
├── scripts/                       # Dev/build utilities
│   ├── build.sh
│   └── package_all.sh
│
└── README.md
```

---

## Key Dependencies

### C++ (via vcpkg)
```
libcurl[http2,ssl]    # HTTP client with HTTP/2 and TLS
cpp-httplib           # Embedded REST server (header-only)
nlohmann-json         # JSON parsing for metadata files
gtest                 # Unit testing
openssl               # SHA-256 checksums
libtorrent            # (Phase 6) Torrent support
```

### Python
```
fastapi               # REST API bridge
uvicorn               # ASGI server
pydantic              # Config validation
yt-dlp                # Video URL extraction
watchdog              # File system monitoring
aiohttp               # Async HTTP (for Python-side requests)
pytest                # Testing
```

### JavaScript
```
electron              # Desktop shell
react                 # UI library
recharts              # Speed graph
electron-builder      # Packaging
vite                  # Frontend bundler
webextension-polyfill # Cross-browser extension compatibility
```

---

## Performance Targets

| Scenario | Target |
|---|---|
| 1 GB file on a fast server | Reach 90%+ of available bandwidth |
| 100 MB file, 16 chunks | Complete within 10% of Free Download Manager time |
| Resume after interruption | < 1 second to detect and resume |
| 3 concurrent downloads | No noticeable CPU spike, steady memory |
| App startup time | < 2 seconds to usable state |
| Extension interception latency | < 100ms from click to Yank receiving URL |

---

## Recommended Learning Resources

| Topic | Resource |
|---|---|
| HTTP Range Requests | MDN Web Docs — `Range` header |
| libcurl multi interface | `curl.se/libcurl/c/libcurl-multi.html` |
| C++ Thread Pool patterns | Anthony Williams — *C++ Concurrency in Action* |
| WebExtensions API | `developer.chrome.com/docs/extensions/mv3` |
| Electron IPC | `electronjs.org/docs/latest/tutorial/ipc` |
| yt-dlp as a library | `github.com/yt-dlp/yt-dlp#embedding-yt-dlp` |
| Reference codebase | `github.com/aria2/aria2` (open-source download manager in C++) |

---

*Start with Phase 2.1 (the C++ HTTP prober) as your first commit. Everything else in Yank builds on top of a working, chunked, resumable downloader.*
