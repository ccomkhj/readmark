#!/usr/bin/env bash
# Rebuild the macOS app (npm run desktop:package) and relaunch it.
# Quits a running Readmark first: the app is single-instance, so a stale copy
# would otherwise keep serving the old build.
set -euo pipefail
cd "$(dirname "$0")"

if pgrep -xq Readmark; then
  echo "quitting running Readmark…"
  osascript -e 'quit app "Readmark"'
  for _ in {1..50}; do pgrep -xq Readmark || break; sleep 0.2; done
  if pgrep -xq Readmark; then echo "Readmark did not quit; close it and retry" >&2; exit 1; fi
fi

npm run desktop:package

# electron-builder writes the app to release/mac/ (x64) or release/mac-<arch>/.
apps=(release/mac*/Readmark.app)
[[ ${#apps[@]} -eq 1 && -d ${apps[0]} ]] || { echo "expected exactly one release/mac*/Readmark.app, found: ${apps[*]}" >&2; exit 1; }
open "${apps[0]}"
