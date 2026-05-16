import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

// State machine for the self-update flow. Each kind maps to a distinct
// `UpdateModal` view; the modal hides itself for `idle`, `checking`, and
// `upToDate` so a no-op check on startup never flashes a dialog at the user.
export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; version: string; notes?: string; date?: string }
  | { kind: "downloading"; downloaded: number; contentLength?: number }
  | { kind: "readyToInstall"; version: string }
  | { kind: "error"; message: string };

export interface UseUpdaterOptions {
  autoCheckOnMount?: boolean;
}

export interface UseUpdaterResult {
  state: UpdateState;
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismiss: () => void;
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
  return "更新処理でエラーが発生しました";
}

export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterResult {
  const { autoCheckOnMount = true } = options;
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  // Cache the Update instance from check() so downloadAndInstall() uses the
  // same one the user accepted in the modal. Re-checking before install
  // would race against version flips and could surprise the user.
  const updateRef = useRef<UpdateLike | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      // Browser-only `pnpm dev` runs do not have the updater plugin. Stay
      // idle so the rest of the app behaves normally outside Tauri.
      return;
    }
    setState({ kind: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = (await check()) as UpdateLike | null;
      // In v2, `check()` returns `null` when there is no update. Some
      // distributions also return an Update with `available: false`, so we
      // accept both shapes defensively.
      if (!update || update.available === false) {
        updateRef.current = null;
        setState({ kind: "upToDate" });
        return;
      }
      updateRef.current = update;
      setState({
        kind: "available",
        version: update.version,
        notes: update.body,
        date: update.date,
      });
    } catch (err) {
      updateRef.current = null;
      setState({ kind: "error", message: errorMessage(err) });
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    const update = updateRef.current;
    if (!update) {
      setState({ kind: "error", message: "更新情報が失われました。再度確認してください。" });
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
      // Install completed. Relaunch into the new version.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  }, []);

  const dismiss = useCallback(() => {
    updateRef.current = null;
    setState({ kind: "idle" });
  }, []);

  useEffect(() => {
    if (!autoCheckOnMount) {
      return;
    }
    // Defer the initial setState into a microtask so the effect body itself
    // stays free of synchronous state updates (avoids the cascading-render
    // pattern flagged by react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      void checkForUpdates();
    });
  }, [autoCheckOnMount, checkForUpdates]);

  return { state, checkForUpdates, downloadAndInstall, dismiss };
}
