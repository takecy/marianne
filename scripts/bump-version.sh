#!/usr/bin/env sh
set -eu

# Synchronise the three places that hold the app version so the Tauri
# updater can compare a release's `latest.json` against the running app.
# All three MUST be in lockstep; if any drifts the updater either reports
# "Up to date" against a newer release or fails to verify artifacts.
#
#   1. package.json              (npm metadata)
#   2. src-tauri/tauri.conf.json (tauri runtime, also embeds version into the
#                                 binary that updater compares against)
#   3. src-tauri/Cargo.toml      (rust crate version)
#
# Called from `.github/workflows/tagging.yaml` after `dry_run` resolves the
# next version, and runnable locally for manual bumps.

usage() {
  echo "Usage: $0 <version>" >&2
  echo "  <version>  Semantic version without leading 'v' (e.g. 0.1.1)" >&2
  exit 2
}

if [ $# -ne 1 ]; then
  usage
fi

VERSION="$1"

# Validate the form so a typo like "v0.1.1" or empty string fails fast.
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *)
    echo "error: version must look like X.Y.Z (got: '$VERSION')" >&2
    exit 1
    ;;
esac

# `cargo set-version` is a cargo-edit extension, not a built-in cargo
# subcommand. Fail explicitly so the operator knows how to install it
# instead of getting a cryptic "no such subcommand" from cargo.
if ! cargo set-version --help >/dev/null 2>&1; then
  echo "error: 'cargo set-version' not found (provided by cargo-edit)." >&2
  echo "  Install with: cargo install cargo-edit" >&2
  echo "  Or in CI: taiki-e/install-action with tool: cargo-edit" >&2
  exit 1
fi

# Resolve script location so we can be run from anywhere (CI, local shell).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PKG_JSON="$ROOT_DIR/package.json"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
CARGO_TOML_DIR="$ROOT_DIR/src-tauri"

# JSON edits via node so we never depend on sed's BSD/GNU divergence and
# preserve formatting deterministically (2-space indent matches existing
# files; deno fmt is happy with that).
node -e "
const fs = require('fs');
const path = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = version;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
" "$PKG_JSON" "$VERSION"

node -e "
const fs = require('fs');
const path = process.argv[1];
const version = process.argv[2];
const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
conf.version = version;
fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
" "$TAURI_CONF" "$VERSION"

# cargo-edit edits Cargo.toml in place and refreshes Cargo.lock implicitly
# on the next cargo invocation. We do not refresh it here so the workflow
# step that follows can decide whether to commit the lockfile change in
# the same commit.
(cd "$CARGO_TOML_DIR" && cargo set-version --package marianne "$VERSION")

echo "Bumped version to $VERSION in:"
echo "  $PKG_JSON"
echo "  $TAURI_CONF"
echo "  $CARGO_TOML_DIR/Cargo.toml"
