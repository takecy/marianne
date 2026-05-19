#!/usr/bin/env sh
set -eu

# Install a locally-built tauri bundle into /Applications/ WITHOUT requiring the
# maintainer's Tauri signing key. Updater artifacts (.app.tar.gz / .sig /
# latest.json) are NOT generated, so this build cannot self-update — pull the
# latest source and rerun this script (or install the official signed release
# from GitHub Releases) to upgrade.
# macOS only. Not codesigned — Gatekeeper will warn on first launch.

if [ "$(uname)" != "Darwin" ]; then
  echo "install:local:unsigned is macOS only (current OS: $(uname))" >&2
  exit 1
fi

APP_NAME="Marianne.app"
SRC="src-tauri/target/release/bundle/macos/${APP_NAME}"
DEST="/Applications/${APP_NAME}"

echo '==> pnpm tauri build (createUpdaterArtifacts=false)'
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'

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
echo "Note: This build is NOT codesigned. On first launch macOS may block it"
echo "with 'cannot be opened because the developer cannot be verified'."
echo "Workaround: right-click the app -> Open, or run:"
echo "  xattr -dr com.apple.quarantine '${DEST}'"
echo ""
echo "Note: Auto-update is disabled in this build (updater artifacts not generated)."
echo "To upgrade, pull the latest source and rerun 'pnpm install:local:unsigned',"
echo "or install the official signed release from GitHub Releases."
