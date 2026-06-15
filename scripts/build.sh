#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Building Yank C++ engine ==="
cd "$ROOT/engine"
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j"$(nproc)"
echo "Engine built: engine/build/yank_engine"

echo ""
echo "=== Installing Python dependencies ==="
cd "$ROOT/orchestrator"
pip install -r requirements.txt

echo ""
echo "=== Installing GUI dependencies ==="
cd "$ROOT/gui"
npm install

echo ""
echo "Build complete!"
