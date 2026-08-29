#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
session_root="$(mktemp -d /tmp/omarchy-typing-sessions.XXXXXX)"
trap 'rm -rf -- "$session_root"' EXIT

ln -s /usr/share/omarchy/shell/Commons "$session_root/Commons"
ln -s /usr/share/omarchy/shell/Ui "$session_root/Ui"
ln -s "$repo_root/components" "$session_root/components"
ln -s "$repo_root/js" "$session_root/js"
cp "$repo_root/tests/qml/high-priority-sessions.qml" "$session_root/shell.qml"
mkdir "$session_root/runtime"
chmod 700 "$session_root/runtime"
session_output="$session_root/output.log"

XDG_RUNTIME_DIR="$session_root/runtime" \
WAYLAND_DISPLAY= \
DISPLAY= \
QT_QPA_PLATFORM=offscreen \
QT_QPA_PLATFORMTHEME= \
QT_QUICK_BACKEND=software \
QT_SCALE_FACTOR=1 \
quickshell --no-duplicate --path "$session_root/shell.qml" --no-color \
  --log-rules "quickshell.ipc=false" >"$session_output" 2>&1

sed -n '/HIGH_PRIORITY_SESSIONS_/p' "$session_output"
grep -q 'HIGH_PRIORITY_SESSIONS_PASS checks=20' "$session_output"
