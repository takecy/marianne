# Security Policy

**English** | [日本語](./SECURITY_ja.md)

## Supported Versions

Only the latest release is supported (see [Releases](https://github.com/takecy/marianne/releases)).
Updates ship through the in-app updater (`tauri-plugin-updater`), so older versions
do not receive backported patches.

## Reporting a Vulnerability

Please report security issues through **GitHub Private Vulnerability Reporting**:

- <https://github.com/takecy/marianne/security/advisories/new>

Do **not** open a public issue or pull request for a security finding.

Expected triage SLA (best-effort, this is a personal project; no strict guarantee):

- **Initial response**: within 7 days
- **Fix or mitigation plan**: within 30 days

When reporting, please include:

- Affected version (or commit SHA)
- Reproduction steps and observed behavior
- Expected behavior
- Any proof-of-concept artifacts (please mark sensitive material clearly)

## Scope

### In scope (please report via PVR)

- Vulnerabilities in distributed binaries (`.dmg` / `.app`)
- Bypasses of the updater path (`tauri-plugin-updater` signature verification,
  `latest.json` flow)
- New exploits that **bypass** Rust trust boundaries such as `safe_image_canonical`
- Compromise of, or vulnerabilities that lead to compromise of, the distribution
  signing keys (`TAURI_SIGNING_PRIVATE_KEY` / `~/.tauri/marianne.key`)
- Compromise of the build and release pipeline (`tagging-release.yaml`, related
  GitHub Actions secrets)

### Known residual risks (also in scope if a concrete exploit is demonstrated)

- `safe_image_canonical` TOCTOU residual: the validation is **symlink decoy
  mitigation + path-string canonicalization only**, and a parent-directory-controlling
  attacker can still race the validated path with the subsequent read. This is
  documented in `CLAUDE.md` and tracked in a separate issue. A concrete exploit
  outside the parent-directory attack model is in scope.
- Apple notarization is not currently performed; the Gatekeeper warning on first
  launch is documented in the README. Any new security implication around this
  area is in scope.

### Out of scope

- Issues specific to the reporter's environment outside Marianne's trust boundary
  (e.g. the reporter's own local `direnv` misconfiguration, permission issues on
  the reporter's machine)
- Already-published upstream CVEs already surfaced via `trivy.yaml`: please do
  not re-report these as new advisories
