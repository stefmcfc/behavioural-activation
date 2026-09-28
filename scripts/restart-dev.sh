#!/usr/bin/env bash
# Restart the local backend/frontend dev servers: stop then start.
# Adapted from the reference project (series-recommendation)'s scripts/restart-dev.sh.
#
# Usage: bash scripts/restart-dev.sh [backend|frontend] [--debug]   (default: both, no debug)

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$DIR/stop-dev.sh" "$@"
"$DIR/start-dev.sh" "$@"
