# Yank — High-Performance Internet Download Manager

> Multi-threaded, resumable, chunk-based downloading — built with C++20, Python, and React.

---

## What is Yank?

Yank is a three-layer download manager inspired by IDM and Free Download Manager. It splits files into parallel byte-range chunks, downloads them simultaneously across multiple connections, and assembles them into the final file — squeezing out near-maximum available bandwidth on fast servers.

The stack is deliberately layered:
- **C++ core** does all the heavy I/O work (raw speed, memory control, true multi-threading)
- **Python orchestrator** handles scheduling, configuration, queuing, and REST routing
- **React GUI** gives you a live dashboard with speed graphs, progress tracking, and download controls

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│           PRESENTATION LAYER (React + Vite)            │
│   Web GUI · port 5000                                  │
│   Browser Extension (Chrome MV3 / Firefox MV2)         │
└──────────────────────┬─────────────────────────────────┘
                       │ REST via /api proxy
┌──────────────────────▼─────────────────────────────────┐
│           ORCHESTRATION LAYER (Python / FastAPI)        │
│   Scheduler · Config Manager · Video Grabber           │
│   port 6801                                            │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTP REST
┌──────────────────────▼─────────────────────────────────┐
│           CORE ENGINE LAYER (C++20)                    │
│   HTTP Client (libcurl) · Chunk Manager · Thread Pool  │
│   Resume Manager · File Assembler · Speed Limiter      │
│   port 6800                                            │
└────────────────────────────────────────────────────────┘
```

---

## Project Layout

```
yank/
├── engine/                  C++20 core download engine
│   ├── CMakeLists.txt
│   ├── include/
│   │   ├── downloader.hpp      Server probe + download orchestration
│   │   ├── chunk_manager.hpp   Byte-range splitting + thread pool
│   │   ├── resume_manager.hpp  .yank metadata persistence
│   │   ├── speed_limiter.hpp   Token-bucket bandwidth control
│   │   └── http_server.hpp     Embedded REST server (raw sockets)
│   ├── src/
│   │   ├── main.cpp            Engine entry point + route wiring
│   │   ├── downloader.cpp      libcurl HEAD probe + download logic
│   │   ├── chunk_manager.cpp   Range requests + thread pool impl
│   │   ├── resume_manager.cpp  JSON metadata save/load
│   │   ├── file_assembler.cpp  Sequential chunk merge → final file
│   │   ├── speed_limiter.cpp   Sliding-window speed tracking
│   │   └── http_server.cpp     Minimal HTTP/1.1 server
│   └── tests/
│       └── test_chunk_manager.cpp
│
├── orchestrator/            Python FastAPI middle layer
│   ├── main.py              Entry point (uvicorn on port 6801)
│   ├── api.py               FastAPI routes + CORS
│   ├── scheduler.py         Priority queue + job lifecycle
│   ├── config.py            Pydantic config model + JSON persistence
│   ├── video_grabber.py     yt-dlp wrapper for video URLs
│   ├── requirements.txt
│   └── tests/
│       └── test_scheduler.py
│
├── extension/               Browser extension
│   ├── manifest.json        Chrome MV3
│   ├── manifest.v2.json     Firefox MV2
│   ├── background/
│   │   └── service_worker.js   Download interception + cookie forwarding
│   ├── content_scripts/
│   │   └── video_detector.js   Injects ⬇ Yank button on video elements
│   └── popup/
│       ├── popup.html
│       └── popup.js
│
├── gui/                     React + Vite web app (port 5000)
│   ├── vite.config.js       Host 0.0.0.0, proxy /api → :6801
│   ├── index.html
│   └── src/
│       ├── App.jsx           Root: header, stats, speed graph, modals
│       ├── hooks/
│       │   └── useDownloads.js  Polling hook (1 s interval)
│       └── components/
│           ├── DownloadList.jsx    Filter tabs + item list
│           ├── DownloadItem.jsx    Row: icon, segmented bar, speed, ETA
│           ├── AddDownloadModal.jsx URL + filename + priority form
│           ├── SpeedGraph.jsx      Recharts area graph (30-pt window)
│           └── SettingsPanel.jsx   Config editor → PATCH /api/config
│
├── scripts/
│   ├── build.sh             Build engine + install all deps
│   └── package_all.sh       Production GUI bundle
│
├── IDM_Project_Plan.md      Full architecture & phase plan
└── README.md
```

---

## Ports

| Service | Port | Bound to |
|---|---|---|
| React GUI (Vite) | 5000 | 0.0.0.0 |
| Python API (FastAPI / uvicorn) | 6801 | localhost |
| C++ engine REST | 6800 | localhost |

The GUI's Vite dev server proxies all `/api/*` requests to `localhost:6801`, so the browser only ever talks to port 5000.

---

## Running

### Start everything (three workflows)

**GUI — port 5000**
```bash
cd gui && npm run dev
```

**Python orchestrator — port 6801**
```bash
cd orchestrator && python main.py
```

**C++ engine — port 6800**
```bash
engine/build/yank_engine 6800
```

All three run automatically as Replit workflows (`Start application`, `Python Orchestrator`, `C++ Engine`).

### Build the C++ engine from source
```bash
cd engine
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

Requires: `cmake`, `gcc`, `libcurl`, `pkg-config`, `openssl` — all installed in the Nix environment.

### Install Python dependencies
```bash
cd orchestrator && pip install -r requirements.txt
```

### Install GUI dependencies
```bash
cd gui && npm install
```

---

## Features

### Core engine (C++20)
- **Range request probing** — sends a `HEAD` request first to check `Accept-Ranges` and `Content-Length`; falls back to single-threaded download if the server doesn't support ranges
- **Multi-chunk parallel download** — splits files into up to 16 byte-range chunks and downloads each in its own thread via `std::jthread`
- **Thread pool** — fixed-size pool avoids per-chunk thread spawn/destroy overhead; workers pick tasks from a lock-free queue
- **Resume manager** — saves a `.yank` JSON metadata file beside the temp chunks; resumes incomplete chunks from their last byte offset on restart
- **File assembler** — merges temp `.part` files in order into the final output; deletes temp files on success
- **Speed limiter** — token-bucket throttle with configurable max KB/s; sliding 5-window rolling average for ETA calculation
- **Embedded HTTP server** — minimal raw-socket HTTP/1.1 server exposes `POST /downloads`, `GET /downloads`, `GET /health`

### Python orchestrator
- **Priority scheduler** — HIGH / NORMAL / LOW priority queue; configurable max concurrent downloads (default 3)
- **REST API** — FastAPI with auto-generated OpenAPI docs at `/docs`
- **Config persistence** — Pydantic model saved to `~/.config/yank/config.json`; PATCH endpoint for live updates
- **Video grabber** — wraps `yt-dlp` to extract direct video URLs and format lists from YouTube, Vimeo, and hundreds of other sites

### Web GUI
- **Live dashboard** — stats bar (total / downloading / complete), real-time speed graph (30-second sliding window via Recharts)
- **Download list** — filterable by status (All / Downloading / Queued / Paused / Complete / Failed)
- **Per-download row** — filename icon by extension, segmented progress bar (IDM-style), speed, ETA, status badge, pause/resume/cancel actions
- **Add download modal** — URL input, optional filename override, priority selector
- **Settings panel** — download folder, connections per file, max concurrent downloads, speed limit
- **API status indicator** — green "API online" / red "API offline" in the header; polls every second
- **Drag & drop** — drop a URL onto the window to pre-fill the add dialog

### Browser extension
- **Download interception** — cancels the browser's own download attempt and hands the URL to Yank via the REST API
- **Cookie forwarding** — captures cookies for the download URL and forwards them with the job so authenticated downloads work
- **Video overlay** — content script scans every page for `<video>` elements and injects a "⬇ Yank" button next to each one
- **Popup UI** — toggle interception on/off, paste a URL directly, open the Yank web app
- **Firefox compatible** — second manifest (`manifest.v2.json`) for MV2 / Firefox

---

## API Reference

The Python orchestrator exposes a REST API on `localhost:6801` (proxied via `/api` from the GUI).

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check + version |
| `POST` | `/downloads` | Queue a new download |
| `GET` | `/downloads` | List all downloads |
| `GET` | `/downloads/{id}` | Get a single download |
| `POST` | `/downloads/{id}/pause` | Pause an active download |
| `POST` | `/downloads/{id}/resume` | Resume a paused download |
| `DELETE` | `/downloads/{id}` | Cancel and remove a download |
| `GET` | `/config` | Get current config |
| `PATCH` | `/config` | Update config (partial) |

Interactive docs available at `http://localhost:6801/docs` when the orchestrator is running.

**Add a download:**
```bash
curl -X POST http://localhost:6801/downloads \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/file.zip", "priority": "high"}'
```

The C++ engine also exposes its own minimal API on `localhost:6800`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Engine health |
| `POST` | `/downloads` | Direct download dispatch |
| `GET` | `/downloads` | List engine-level jobs |

---

## Configuration

Settings are stored at `~/.config/yank/config.json` and editable via the Settings panel in the GUI.

| Setting | Default | Description |
|---|---|---|
| `default_download_dir` | `~/Downloads` | Where finished files are saved |
| `max_connections_per_file` | `16` | Parallel chunks per download |
| `max_concurrent_downloads` | `3` | Downloads running at the same time |
| `speed_limit_kbps` | `0` | Global bandwidth cap (0 = unlimited) |
| `engine_port` | `6800` | C++ engine port |
| `api_port` | `6801` | Python orchestrator port |

---

## Installing the Browser Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. The Yank icon appears in your toolbar

For Firefox, use `manifest.v2.json` and load via `about:debugging`.

---

## Performance Targets

| Scenario | Target |
|---|---|
| 1 GB file on a fast server | ≥ 90% of available bandwidth |
| 100 MB file, 16 chunks | Within 10% of Free Download Manager |
| Resume after interruption | < 1 second to detect and resume |
| 3 concurrent downloads | No noticeable CPU spike |
| App startup time | < 2 seconds to usable state |
| Extension interception latency | < 100 ms from click to Yank receiving URL |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Download engine | C++20 | Maximum performance, true multi-threading, direct I/O control |
| HTTP client | libcurl 8.x | HTTP/1.1 + HTTP/2, HTTPS, cookies, redirects, proxies |
| Concurrency | `std::jthread` + thread pool | C++20 safe threads, no external dependency |
| Orchestration | Python 3.11 + asyncio | Fast scheduling, plugin logic, async I/O |
| API bridge | FastAPI + uvicorn | Async, OpenAPI auto-docs |
| Browser extension | WebExtensions API | Only cross-browser option |
| GUI | React 18 + Vite | Fast iteration, rich ecosystem |
| Charts | Recharts | Composable React charting |
| Icons | Lucide React | Consistent icon set |
| Video extraction | yt-dlp | 1000+ supported sites |

---

## Roadmap

- [ ] Wire Python scheduler → C++ engine (dispatch real chunked downloads)
- [ ] Per-chunk progress reporting from engine back to GUI
- [ ] HTTP/2 multiplexing via libcurl
- [ ] Smart chunk rebalancer (steal bytes from slow connections)
- [ ] Batch download from `.txt` URL lists
- [ ] Torrent support via libtorrent
- [ ] Post-download actions (auto-open, custom script, OS notification, auto-extract)
- [ ] SHA-256 integrity verification per chunk and final file
- [ ] Scheduled downloads (time-window picker)
- [ ] Unit + integration test suite (gtest / pytest / vitest)
