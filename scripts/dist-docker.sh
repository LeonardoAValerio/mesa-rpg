#!/usr/bin/env bash
# Builds the Windows NSIS installer on Linux. electron-builder needs Wine to make the uninstaller,
# so packaging runs in electron-builder's official Wine image; the app itself is built on the host.
set -euo pipefail
IMAGE=electronuserland/builder:22-wine-10.26
cd "$(dirname "$0")/.."
"$PWD/scripts/with-node" npx electron-vite build

# The container runs as this user, so dist/ stays ours; Wine needs a HOME this user owns.
home=$(mktemp -d)
trap 'rm -rf "$home"' EXIT
mkdir -p "$home/.cache/electron" "$home/.cache/electron-builder" "$HOME/.cache/electron" "$HOME/.cache/electron-builder"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/home/builder \
  -v "$home":/home/builder \
  -v "$HOME/.cache/electron":/home/builder/.cache/electron \
  -v "$HOME/.cache/electron-builder":/home/builder/.cache/electron-builder \
  -v "$PWD":/project \
  -w /project \
  "$IMAGE" \
  npx electron-builder --win nsis --x64 --publish never
