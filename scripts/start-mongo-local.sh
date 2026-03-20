#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MONGO_BIN="$ROOT_DIR/.local/mongodb-7.0.14/bin/mongod"
DATA_DIR="$ROOT_DIR/.local/mongodb-data"

if [ ! -x "$MONGO_BIN" ]; then
    MONGO_BIN="$(command -v mongod || true)"
fi

if [ -z "${MONGO_BIN:-}" ] || [ ! -x "$MONGO_BIN" ]; then
    echo "mongod nao encontrado. Instale MongoDB ou disponibilize .local/mongodb-7.0.14/bin/mongod." >&2
    exit 1
fi

mkdir -p "$DATA_DIR"
exec "$MONGO_BIN" --dbpath "$DATA_DIR" --bind_ip 127.0.0.1 --port 27017
