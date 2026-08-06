import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { t } from "@/i18n/translate";

// Where an update check was started from. Failures of an `auto` check stay
// silent because Marianne is offline-first: "no network" is the normal case,
// and reporting it on every launch would be noise. `manual` (menu) and
// `install` failures are user-initiated, so they are surfaced.
export type CheckOrigin = "auto" | "manual";
export type UpdateErrorOrigin = CheckOrigin | "install";

// Outcome of `checkForUpdates`. Returned so callers can react to the result
// directly instead of watching for a state transition in an effect — a
// `setState` in an effect body trips react-compiler's set-state-in-effect
// rule (the mount effect below works around the same constraint).
// `idle` covers the non-Tauri branch and results dropped by the generation
// guard.
export type CheckResult = "idle" | "upToDate" | "available" | "error";

// State machine for the self-update flow. Each kind maps to what the
// bottom-left notice slot renders; the mapping itself lives in
// `src/lib/updateNotice.ts` so it can be unit tested without React.
export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; version: string; notes?: string; date?: string }
  | { kind: "downloading"; downloaded: number; contentLength?: number }
  | { kind: "readyToInstall"; version: string }
  // Installed on disk, but the relaunch was held back because `canRelaunch`
  // said no. The process keeps running the old code (macOS keeps the running
  // bundle's inode alive), so waiting here is safe.
  | { kind: "awaitingRelaunch"; version: string }
  | { kind: "error"; message: string; origin: UpdateErrorOrigin };

export interface UseUpdaterOptions {
  autoCheckOnMount?: boolean;
  // Consulted immediately BEFORE relaunching, not when the update starts.
  // A download takes seconds during which the canvas stays editable, so a
  // decision made at click time is stale by the time the install finishes:
  // the user can start annotating after clicking and lose that work to the
  // relaunch. Returning false parks the update in `awaitingRelaunch`.
  canRelaunch?: () => boolean;
}

export interface UseUpdaterResult {
  state: UpdateState;
  checkForUpdates: (origin?: CheckOrigin) => Promise<CheckResult>;
  downloadAndInstall: () => Promise<void>;
  relaunchNow: () => Promise<void>;
}

interface UpdateLike {
  available?: boolean;
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall: (cb?: (event: DownloadProgressEvent) => void) => Promise<void>;
}

type DownloadProgressEvent =
  | { event: "Started"; data?: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return t("error.update.generic");
}

export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterResult {
  const { autoCheckOnMount = true, canRelaunch } = options;
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  // Mirrored so the guard is read through the caller's latest closure at the
  // moment of the relaunch, not the one captured when the update started.
  const canRelaunchRef = useRef(canRelaunch);
  useLayoutEffect(() => {
    canRelaunchRef.current = canRelaunch;
  });
  // Cache the Update instance from check() so downloadAndInstall() uses the
  // same one the user acted on. Re-checking before install would race against
  // version flips and could surprise the user.
  const updateRef = useRef<UpdateLike | null>(null);
  // Monotonic id for in-flight checks. A check that resolves after a newer one
  // started must not write its now-stale result: the startup auto-check can
  // still be pending when the user runs a manual check from the menu, and a
  // late auto-check failure would otherwise overwrite the state and clear
  // `updateRef`, silently dropping an update the user was already shown.
  const checkSeqRef = useRef(0);

  const checkForUpdates = useCallback(
    async (origin: CheckOrigin = "manual"): Promise<CheckResult> => {
      if (!isTauri()) {
        // Browser-only `pnpm dev` runs do not have the updater plugin. Stay
        // idle so the rest of the app behaves normally outside Tauri.
        return "idle";
      }
      // An Update is already in hand, so re-checking can only lose it: the
      // catch below clears `updateRef`, meaning one failed manual re-check
      // would remove both the notice and the only path to install the update
      // we already found. Report what we know and skip the request.
      if (updateRef.current) {
        return "available";
      }
      const seq = ++checkSeqRef.current;
      setState({ kind: "checking" });
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = (await check()) as UpdateLike | null;
        if (seq !== checkSeqRef.current) {
          return "idle";
        }
        // In v2, `check()` returns `null` when there is no update. Some
        // distributions also return an Update with `available: false`, so we
        // accept both shapes defensively.
        if (!update || update.available === false) {
          updateRef.current = null;
          setState({ kind: "upToDate" });
          return "upToDate";
        }
        updateRef.current = update;
        setState({
          kind: "available",
          version: update.version,
          notes: update.body,
          date: update.date,
        });
        return "available";
      } catch (err) {
        if (seq !== checkSeqRef.current) {
          return "idle";
        }
        updateRef.current = null;
        setState({ kind: "error", message: errorMessage(err), origin });
        return "error";
      }
    },
    [],
  );

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    const update = updateRef.current;
    if (!update) {
      setState({ kind: "error", message: t("error.update.infoLost"), origin: "install" });
      return;
    }
    setState({ kind: "downloading", downloaded: 0 });
    try {
      let downloaded = 0;
      let contentLength: number | undefined;
      await update.downloadAndInstall((event) => {
        // Progress callback updates the UI only. The actual install completes
        // when the await resolves; calling relaunch() inside this callback
        // would terminate the process before install finishes.
        if (event.event === "Started") {
          contentLength = event.data?.contentLength;
          downloaded = 0;
          // `downloaded` and `contentLength` are mutable locals accumulated
          // across callback invocations. Memoizing them would freeze the
          // progress readout.
          // oxlint-disable-next-line react/react-compiler
          setState({ kind: "downloading", downloaded, contentLength });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState({ kind: "downloading", downloaded, contentLength });
        } else if (event.event === "Finished") {
          // Download is finished; install is still in progress until
          // downloadAndInstall() resolves below.
          setState({ kind: "readyToInstall", version: update.version });
        }
      });
      // Install completed. Load the process module FIRST so that nothing
      // awaits between the guard and the relaunch: this is the plugin's first
      // use, so the dynamic import is a real chunk fetch, and a `mouseup`
      // committing a new shape could land in that window and be destroyed by
      // a relaunch that was authorised a moment earlier.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      if (canRelaunchRef.current?.() === false) {
        setState({ kind: "awaitingRelaunch", version: update.version });
        return;
      }
      await relaunch();
    } catch (err) {
      // `updateRef` is deliberately kept so clicking the notice again retries
      // the install without needing a fresh check.
      setState({ kind: "error", message: errorMessage(err), origin: "install" });
    }
  }, []);

  // Completes an update parked in `awaitingRelaunch`. The install already
  // happened, so this only restarts the process.
  const relaunchNow = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }, []);

  useEffect(() => {
    if (!autoCheckOnMount) {
      return;
    }
    // Defer the initial setState into a microtask so the effect body itself
    // stays free of synchronous state updates (avoids the cascading-render
    // pattern flagged by react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      void checkForUpdates("auto");
    });
  }, [autoCheckOnMount, checkForUpdates]);

  return { state, checkForUpdates, downloadAndInstall, relaunchNow };
}
