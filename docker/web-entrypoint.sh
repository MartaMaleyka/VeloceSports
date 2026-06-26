#!/bin/sh
set -e

if [ -z "${JWT_ACCESS_SECRET:-}" ] || [ "${#JWT_ACCESS_SECRET}" -lt 32 ]; then
  echo "ERROR: JWT_ACCESS_SECRET ausente o demasiado corto (min 32 caracteres)." >&2
  exit 1
fi

if [ ! -f ./dist/server/entry.mjs ]; then
  echo "ERROR: no se encontró ./dist/server/entry.mjs" >&2
  exit 1
fi

exec node ./dist/server/entry.mjs
