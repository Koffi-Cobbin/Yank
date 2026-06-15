# Yank — High-Performance Internet Download Manager

## Overview

Yank is a multi-layered download manager inspired by IDM and Free Download Manager. It targets maximum download speeds via HTTP range requests, multi-threaded chunking, and intelligent connection management.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│           PRESENTATION LAYER (React + Vite)            │
│   Web GUI on port 5000  ←→  Browser Extension          │
└──────────────────────┬─────────────────────────────────┘
                       │ REST API via /api proxy
┌──────────────────────▼─────────────────────────────────┐
│           ORCHESTRATION LAYER (Python/FastAPI)         │
│   Config Manager · Scheduler · Plugin System           │
│   Port 6801                                            │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTP REST (cpp-httplib)
┌──────────────────────▼─────────────────────────────────┐
│           CORE ENGINE LAYER (C++20)                    │
│   HTTP Client · Chunk Manager · Thread Pool            │
│   Resume Manager · File Assembler · Speed Limiter      │
│   Port 6800                                            │
└────────────────────────────────────────────────────────┘
```

## Project Layout

```
yank/
├── engine/          C++20 core download engine (libcurl, custom HTTP server)
├── orchestrator/    Python FastAPI bridge & scheduler
├── extension/       Browser extension (Chrome MV3 / Firefox MV2)
├── gui/             React + Vite web GUI (port 5000)
└── scripts/         Build and packaging utilities
```

## Running

### GUI only (frontend)
```bash
cd gui && npm install && npm run dev
```

### Python orchestrator (API backend)
```bash
cd orchestrator && pip install -r requirements.txt && python main.py
```

### C++ engine
```bash
cd engine && mkdir -p build && cd build && cmake .. && make && ./yank_engine
```

## Ports

| Service | Port | Host |
|---------|------|------|
| React GUI (Vite) | 5000 | 0.0.0.0 |
| Python API (FastAPI) | 6801 | localhost |
| C++ engine REST | 6800 | localhost |

## User Preferences

- Dark theme throughout
- Keep frontend on port 5000
- Python orchestrator on port 6801
- C++ engine on port 6800
