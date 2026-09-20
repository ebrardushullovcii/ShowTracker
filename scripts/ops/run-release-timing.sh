#!/usr/bin/env bash
set -euo pipefail
cd "${SHOWTRACKER_APP_DIR:-/opt/showtracker}"
# Same lock as nightly maintenance. No git update, import, or broad apply here.
flock -n -E 75 /tmp/showtracker-schedule-confidence.lock node --no-warnings=ExperimentalWarning scripts/release-timing.mjs --apply
