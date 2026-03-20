#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
NODE_BIN="$ROOT_DIR/.local/node-v20.19.2/bin/node"

if [ ! -x "$NODE_BIN" ]; then
    NODE_BIN="$(command -v node || true)"
fi

if [ -z "${NODE_BIN:-}" ] || [ ! -x "$NODE_BIN" ]; then
    echo "Node.js nao encontrado. Instale Node 20+ ou disponibilize .local/node-v20.19.2/bin/node." >&2
    exit 1
fi

cd "$ROOT_DIR"
exec "$NODE_BIN" src/index.js
