#!/usr/bin/env sh
set -eu

# Build the macOS dmg bundle WITHOUT requiring the maintainer's Tauri signing
# key, and copy it into ./dist-bundle for local testing or contributor use.
# Updater artifacts (.app.tar.gz / .sig / latest.json) are NOT generated, so
# the resulting dmg cannot self-update and must not be used as a release
# artifact — the official release flow uses scripts/build-dmg.sh + the
# maintainer's signing key via .github/workflows/tagging-release.yaml.
# macOS only. Not codesigned — recipients need to bypass Gatekeeper on first launch.
# Produces an aarch64 (Apple Silicon) only dmg; Intel Macs are not supported.

if [ "$(uname)" != "Darwin" ]; then
  echo "build:dmg:unsigned is macOS only (current OS: $(uname))" >&2
  exit 1
fi

DMG_GLOB="src-tauri/target/release/bundle/dmg/Marianne_*_aarch64.dmg"
DEST_DIR="dist-bundle"

# Clean stale dmg outputs so the glob below resolves to a single fresh artifact.
# Loop tolerates an empty glob (unmatched pattern stays in $stale, -e is false).
for stale in $DMG_GLOB; do
  [ -e "$stale" ] && rm -f "$stale"
done

echo '==> pnpm tauri build (createUpdaterArtifacts=false)'
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'

# Resolve the freshly built dmg via glob (single match expected).
# shellcheck disable=SC2086
set -- $DMG_GLOB
if [ ! -e "$1" ]; then
  echo "Built dmg not found: ${DMG_GLOB}" >&2
  echo "Check the bundle output of 'pnpm tauri build'." >&2
  exit 1
fi

SRC_DMG="$1"
DEST_DMG="${DEST_DIR}/$(basename "${SRC_DMG}")"

mkdir -p "${DEST_DIR}"
echo "==> Copying ${SRC_DMG} -> ${DEST_DMG}"
cp "${SRC_DMG}" "${DEST_DMG}"

echo ""
echo "Built:     ${DEST_DMG}"
echo "Size:      $(du -h "${DEST_DMG}" | awk '{print $1}')"
echo "Reveal:    open ${DEST_DIR}/"
echo ""
echo "Note: This build is NOT codesigned and targets Apple Silicon (aarch64) only."
echo "On first launch macOS may block it with 'cannot be opened because the developer"
echo "cannot be verified'. Recipients should right-click the .app and choose 'Open',"
echo "or run:"
echo "  xattr -dr com.apple.quarantine /Applications/Marianne.app"
echo ""
echo "Note: Auto-update is disabled in this build (updater artifacts not generated)."
echo "This dmg must NOT be redistributed as a release — it lacks the signing"
echo "metadata required by the Tauri updater. Use the official GitHub Releases"
echo "build for distribution."
