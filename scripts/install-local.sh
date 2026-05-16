#!/usr/bin/env sh
set -eu

# Install the latest tauri build into /Applications/ for daily local use.
# macOS only. Not codesigned — Gatekeeper will warn on first launch.

if [ "$(uname)" != "Darwin" ]; then
  echo "install:local is macOS only (current OS: $(uname))" >&2
  exit 1
fi

APP_NAME="Marianne.app"
SRC="src-tauri/target/release/bundle/macos/${APP_NAME}"
DEST="/Applications/${APP_NAME}"

echo "==> pnpm tauri build"
pnpm tauri build

if [ ! -d "${SRC}" ]; then
  echo "Build output not found: ${SRC}" >&2
  echo "Check the bundle output of 'pnpm tauri build'." >&2
  exit 1
fi

if [ -d "${DEST}" ]; then
  echo "==> Removing existing ${DEST}"
  rm -rf "${DEST}"
fi

echo "==> Copying ${SRC} -> ${DEST}"
cp -R "${SRC}" "${DEST}"

echo ""
echo "Installed: ${DEST}"
echo "Open:      open '${DEST}'"
echo ""
echo "Note: This build is not codesigned. On first launch macOS may block it"
echo "with 'cannot be opened because the developer cannot be verified'."
echo "Workaround: right-click the app -> Open, or run:"
echo "  xattr -dr com.apple.quarantine '${DEST}'"
