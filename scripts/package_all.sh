#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Building GUI for production ==="
cd "$ROOT/gui"
npm run build

echo ""
echo "=== Build output in gui/dist/ ==="
ls -lh "$ROOT/gui/dist/"
