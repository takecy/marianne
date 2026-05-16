import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

// State machine for the Cmd+Q / tray Quit confirmation flow. The Rust
// side emits `quit-requested` on `RunEvent::ExitRequested`; this hook
// listens for it, shows the dialog only when there are unsaved shapes,
// and uses the `confirm_quit` invoke to acknowledge "Quit" from the
// user. See plans/1-mac-cmd-q-flickering-diffie.md for the full state
// machine including the cold-start RendererReady handshake.
export type QuitConfirmState = { kind: "idle" } | { kind: "confirming" };

export interface UseQuitConfirmOptions {
  hasUnsavedShapes: boolean;
}

export interface UseQuitConfirmResult {
  state: QuitConfirmState;
  confirmQuit: () => Promise<void>;
  cancelQuit: () => void;
}

export function useQuitConfirm(options: UseQuitConfirmOptions): UseQuitConfirmResult {
  const { hasUnsavedShapes } = options;
  const [state, setState] = useState<QuitConfirmState>({ kind: "idle" });

  // Mirror hasUnsavedShapes into a ref so the listener can read the
  // latest value without being torn down and rebuilt on every change.
  //
  // CRITICAL: This MUST run in useLayoutEffect, not useEffect. A passive
  // useEffect defers the ref update until after the browser paints, so
  // between shapes.length transitioning 0 -> 1 and the passive effect
  // running, a `quit-requested` event arriving from the Rust IPC thread
  // would observe ref.current === false and immediately invoke
  // `confirm_quit` — terminating the app without the modal even though
  // the user just drew a shape. That is a data-loss path that defeats
  // this feature. useLayoutEffect runs synchronously in the React commit
  // phase before the browser yields to the event loop, so no IPC event
  // can interleave between commit and the ref update. The structural
  // test in useQuitConfirm.test.ts asserts that the mirror lives in
  // useLayoutEffect (not a passive useEffect) to guard against regression.
  const hasUnsavedShapesRef = useRef(hasUnsavedShapes);
  useLayoutEffect(() => {
    hasUnsavedShapesRef.current = hasUnsavedShapes;
  }, [hasUnsavedShapes]);

  const confirmQuit = useCallback(async () => {
    if (!isTauri()) return;
    setState({ kind: "idle" });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("confirm_quit");
    } catch (err) {
      // confirm_quit has no failure path in Rust, but log defensively.
      console.error("confirm_quit failed:", err);
    }
  }, []);

  const cancelQuit = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const { invoke } = await import("@tauri-apps/api/core");
      const un = await listen("quit-requested", () => {
        if (!hasUnsavedShapesRef.current) {
          // Nothing to lose — confirm immediately so the user does not
          // see a needless dialog flash.
          void (async () => {
            try {
              await invoke("confirm_quit");
            } catch (err) {
              console.error("confirm_quit failed:", err);
            }
          })();
          return;
        }
        setState({ kind: "confirming" });
      });
      if (cancelled) {
        un();
        return;
      }
      unlistenFn = un;
      // Signal Rust that the listener is registered. Until this returns,
      // the Rust ExitRequested handler falls through to a normal exit
      // (cold-start safety net). Order matters: must be after `await
      // listen` resolves so we cannot lose a `quit-requested` event
      // between the RendererReady flag flip and the listener being live.
      try {
        await invoke("renderer_ready");
      } catch (err) {
        // Failing here means the user will not get the confirmation
        // dialog on quit, but the app will still be quittable. Log
        // defensively but do not throw.
        console.error("renderer_ready failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  return { state, confirmQuit, cancelQuit };
}
