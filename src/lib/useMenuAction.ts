import { useEffect, useLayoutEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";

// Menu ids must stay byte-identical with `src-tauri/src/lib.rs`
// (`MenuItemBuilder::with_id("...")`). Adding a new menu item requires
// touching both files — keep the table in sync by manual diff.
export interface MenuActionOptions {
  onOpen: () => void;
  onSaveAs: () => void;
  onCopyToClipboard: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

// True when the focused element is an OS-native text edit context (input,
// textarea, or any contenteditable region). Used to keep menu Cmd+Z out of
// the canvas undo when the user is typing — Cocoa routes the accelerator to
// us regardless of focus, so the hook reroutes to `document.execCommand`
// for the native text-edit undo/redo. Mirrors the bail-out in
// `CanvasArea.tsx` keydown handler so behaviour stays consistent.
function isInTextEditContext(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Subscribe to the `menu-action` channel emitted by Rust's `on_menu_event`
 * (see `src-tauri/src/lib.rs`) and dispatch each menu id to the matching
 * handler from `options`. Mirrors the cancelled / unlisten pattern from
 * `useQuitConfirm.ts:62-108`.
 *
 * Handlers are mirrored to a ref so the listener does not re-register on
 * every render but callers still see the latest closure.
 *
 * The switch is intentionally synchronous — `onCopyToClipboard` must keep
 * the WebKit transient user activation alive when it (synchronously) calls
 * `navigator.clipboard.write`, so awaiting anything here would break the
 * Promise-handoff contract documented in CLAUDE.md.
 */
export function useMenuAction(options: MenuActionOptions): void {
  const optionsRef = useRef(options);
  // Mirror the latest options into the ref after commit so the listener
  // (registered once on mount) always sees the freshest closures without
  // re-subscribing. Updating the ref during render is disallowed by
  // react-hooks/refs in React 19, so we route through useLayoutEffect.
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlistenFn: (() => void) | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<string>("menu-action", (event) => {
        const id = event.payload;
        const opts = optionsRef.current;
        switch (id) {
          case "file-open":
            opts.onOpen();
            break;
          case "file-save-as":
            opts.onSaveAs();
            break;
          case "file-copy-clipboard":
            opts.onCopyToClipboard();
            break;
          case "edit-undo":
            if (isInTextEditContext()) {
              document.execCommand("undo");
            } else {
              opts.onUndo();
            }
            break;
          case "edit-redo":
            if (isInTextEditContext()) {
              document.execCommand("redo");
            } else {
              opts.onRedo();
            }
            break;
          case "edit-delete":
            opts.onDelete();
            break;
          default:
            break;
        }
      });
      if (cancelled) {
        un();
        return;
      }
      unlistenFn = un;
    })();
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);
}
