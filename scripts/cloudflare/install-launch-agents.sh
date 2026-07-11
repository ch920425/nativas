#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
target="$HOME/Library/LaunchAgents"
mkdir -p "$target"
for label in ai.nativas.origin ai.nativas.tunnel; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  sed "s|__PROJECT_ROOT__|$root|g" "$root/cloudflare/launchd/$label.plist" > "$target/$label.plist"
  if ! launchctl bootstrap "gui/$(id -u)" "$target/$label.plist"; then
    launchctl load -w "$target/$label.plist"
  fi
done
launchctl kickstart -k "gui/$(id -u)/ai.nativas.origin"
launchctl kickstart -k "gui/$(id -u)/ai.nativas.tunnel"
echo "Nativas origin and named-tunnel launch agents are running."
