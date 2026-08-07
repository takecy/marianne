import type { UpdateState } from "@/lib/useUpdater";

// What the bottom-left notice slot renders. `null` means the slot is not
// rendered at all, which is the whole point of the design: something in the
// bottom-left corner means "a new version exists", nothing else. Keeping this
// a pure function (no React, no Konva) lets the mapping be unit tested
// directly, following the drawingGesture / imageFit / cropImage pattern.
export type UpdateNotice =
  | { kind: "available"; version: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installing" }
  // Installed but not restarted yet, because annotations would have been
  // lost. Clickable: this is how the user finishes the update.
  | { kind: "relaunch" }
  | { kind: "failed"; message: string };

export function deriveUpdateNotice(state: UpdateState): UpdateNotice | null {
  switch (state.kind) {
    case "available":
      return { kind: "available", version: state.version };
    case "downloading":
      return { kind: "downloading", percent: downloadPercent(state) };
    case "readyToInstall":
      return { kind: "installing" };
    case "awaitingRelaunch":
      return { kind: "relaunch" };
    case "error":
      // Only an install failure keeps the slot visible. At that point an
      // update is known to exist, so the bell still means what it says and
      // doubles as the retry affordance. Check failures do not belong here:
      // an `auto` failure is silent (offline is the normal case for this
      // app), and a `manual` failure is reported in the StatusBar so an
      // inconclusive check never looks like "an update is available".
      return state.origin === "install" ? { kind: "failed", message: state.message } : null;
    default:
      // idle / checking / upToDate — nothing to announce.
      return null;
  }
}

function downloadPercent(state: Extract<UpdateState, { kind: "downloading" }>): number | null {
  const { downloaded, contentLength } = state;
  if (contentLength === undefined || contentLength <= 0) {
    return null;
  }
  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}
