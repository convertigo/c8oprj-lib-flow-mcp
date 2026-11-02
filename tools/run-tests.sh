#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
engine=${FLOW_ENGINE_RESOURCE_ROOT:-"$root/../lib_flow_engine/_flow"}
runner="$engine/../tools/run-library-tests.cjs"
[ -f "$runner" ] || { echo 'Missing Engine test harness; set FLOW_ENGINE_RESOURCE_ROOT=<engine>/_flow (Mission 28 runner required).' >&2; exit 2; }
command -v node >/dev/null || { echo 'Missing node on PATH (Node 24 recommended).' >&2; exit 2; }
exec node "$runner" mcp "$root" "$@"
