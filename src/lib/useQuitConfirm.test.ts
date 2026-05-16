import { act, renderHook, waitFor } from "@testing-library/react";
// Vite `?raw` import loads the source as a string at build time. Used by
// the structural test below to assert the hook-body ref-mirror layout
// without depending on @types/node.
import useQuitConfirmSource from "./useQuitConfirm.ts?raw";
import { useQuitConfirm } from "./useQuitConfirm";

// Captured listeners keyed by event name, plus a way to control whether
// the `listen` promise resolves immediately or stays pending — needed
// for the ordering test (renderer_ready must be invoked AFTER listen
// resolves, not before).
type Listener = (event: { payload: unknown }) => void;
const listeners: Record<string, Listener[]> = {};
let listenResolver: (() => void) | null = null;
let pendingListen = false;

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  // Mirror useUpdater.test.ts: pivot on a global flag so tests can flip
  // Tauri presence without re-mocking the module per case.
  isTauri: () => !!(globalThis as unknown as { isTauri?: boolean }).isTauri,
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async (event: string, handler: Listener) => {
    listeners[event] ??= [];
    listeners[event].push(handler);
    if (pendingListen) {
      // Block until the test releases the listen promise.
      await new Promise<void>((res) => {
        listenResolver = res;
      });
    }
    return () => {
      const arr = listeners[event];
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    };
  },
}));

function emitQuitRequested(): void {
  const handlers = listeners["quit-requested"] ?? [];
  for (const h of handlers) {
    h({ payload: undefined });
  }
}

beforeEach(() => {
  mockInvoke.mockReset();
  // Default: invoke succeeds.
  mockInvoke.mockResolvedValue(undefined);
  for (const k of Object.keys(listeners)) {
    listeners[k] = [];
  }
  listenResolver = null;
  pendingListen = false;
  (globalThis as unknown as { isTauri?: boolean }).isTauri = true;
});

afterEach(() => {
  delete (globalThis as unknown as { isTauri?: boolean }).isTauri;
});

describe("useQuitConfirm", () => {
  it("invokes confirm_quit immediately when there are no unsaved shapes", async () => {
    const { result } = renderHook(() => useQuitConfirm({ hasUnsavedShapes: false }));
    await waitFor(() => expect(listeners["quit-requested"]?.length).toBe(1));
    // Wait for the renderer_ready handshake to settle so we can isolate
    // the confirm_quit call below.
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
    mockInvoke.mockClear();

    act(() => emitQuitRequested());
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("confirm_quit"));
    expect(result.current.state).toEqual({ kind: "idle" });
  });

  it("transitions to confirming when there are unsaved shapes", async () => {
    const { result } = renderHook(() => useQuitConfirm({ hasUnsavedShapes: true }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
    mockInvoke.mockClear();

    act(() => emitQuitRequested());
    expect(result.current.state).toEqual({ kind: "confirming" });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("cancelQuit returns to idle", async () => {
    const { result } = renderHook(() => useQuitConfirm({ hasUnsavedShapes: true }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
    act(() => emitQuitRequested());
    expect(result.current.state.kind).toBe("confirming");

    act(() => result.current.cancelQuit());
    expect(result.current.state).toEqual({ kind: "idle" });
  });

  it("confirmQuit invokes confirm_quit and resets to idle", async () => {
    const { result } = renderHook(() => useQuitConfirm({ hasUnsavedShapes: true }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
    act(() => emitQuitRequested());
    expect(result.current.state.kind).toBe("confirming");

    mockInvoke.mockClear();
    await act(async () => {
      await result.current.confirmQuit();
    });
    expect(mockInvoke).toHaveBeenCalledWith("confirm_quit");
    expect(result.current.state).toEqual({ kind: "idle" });
  });

  it("is a no-op outside Tauri", async () => {
    (globalThis as unknown as { isTauri?: boolean }).isTauri = false;
    renderHook(() => useQuitConfirm({ hasUnsavedShapes: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(listeners["quit-requested"]?.length ?? 0).toBe(0);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("reads the latest hasUnsavedShapes via the in-body ref mirror", async () => {
    const { rerender } = renderHook(
      (props: { hasUnsavedShapes: boolean }) => useQuitConfirm(props),
      { initialProps: { hasUnsavedShapes: true } },
    );
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));

    // Flip to "no unsaved shapes" and immediately receive an event:
    // the listener should observe the new value via the ref and invoke
    // confirm_quit instead of opening the modal.
    rerender({ hasUnsavedShapes: false });
    mockInvoke.mockClear();
    act(() => emitQuitRequested());
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("confirm_quit"));
  });

  it("invokes renderer_ready exactly once on mount", async () => {
    renderHook(() => useQuitConfirm({ hasUnsavedShapes: false }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
    const readyCalls = mockInvoke.mock.calls.filter(
      (c) => c[0] === "renderer_ready",
    );
    expect(readyCalls).toHaveLength(1);
  });

  it("does NOT invoke renderer_ready before listen() resolves", async () => {
    // Make `listen` hang until we explicitly resolve it.
    pendingListen = true;
    renderHook(() => useQuitConfirm({ hasUnsavedShapes: false }));
    // Yield twice to let pending microtasks settle. The listener should
    // be queued in `listeners` only after listen() resolves, but for
    // this test we only care that renderer_ready has not been called.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("renderer_ready");

    // Now release listen() and renderer_ready should fire.
    await act(async () => {
      listenResolver?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("renderer_ready"));
  });

  it("does not invoke renderer_ready if the hook unmounts before listen resolves", async () => {
    pendingListen = true;
    const { unmount } = renderHook(() => useQuitConfirm({ hasUnsavedShapes: false }));
    unmount();
    // Now resolve listen(); the cancelled flag should prevent the
    // post-listen `renderer_ready` invoke.
    await act(async () => {
      listenResolver?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("renderer_ready");
  });

  // Structural regression guard. Behavioural test of stale-ref via
  // passive useEffect is impossible because @testing-library/react
  // flushes passive effects through act() automatically. We assert
  // the source code directly: the ref mirror must live inside a
  // useLayoutEffect (which runs in React's commit phase before the
  // browser yields to the event loop), NOT a passive useEffect
  // (which defers until after paint and admits the IPC race).
  it("mirrors hasUnsavedShapes via useLayoutEffect, not useEffect (structural)", () => {
    const source = useQuitConfirmSource;
    // Must be inside a useLayoutEffect block with [hasUnsavedShapes] deps.
    expect(source).toMatch(
      /useLayoutEffect\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?hasUnsavedShapesRef\.current\s*=\s*hasUnsavedShapes;?[\s\S]*?\}\s*,\s*\[hasUnsavedShapes\]\s*\)/,
    );
    // Must NOT appear inside any passive useEffect(...) block.
    expect(source).not.toMatch(
      /(?<!Layout)useEffect\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?hasUnsavedShapesRef\.current\s*=\s*hasUnsavedShapes[\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)/,
    );
  });
});
