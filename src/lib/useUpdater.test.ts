import { act, renderHook, waitFor } from "@testing-library/react";
// Vite `?raw` import loads the source as a string at build time, mirroring
// the structural test in useQuitConfirm.test.ts.
import useUpdaterSource from "./useUpdater.ts?raw";
import { useUpdater } from "./useUpdater";

type ProgressEvent =
  | { event: "Started"; data?: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

interface MockUpdate {
  available?: boolean;
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall: (cb?: (event: ProgressEvent) => void) => Promise<void>;
}

const mockCheck = vi.fn();
const mockRelaunch = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  // Mirror useImageLoader.test.tsx: pivot on a global flag so tests can flip
  // Tauri presence without re-mocking the module per case.
  isTauri: () => !!(globalThis as unknown as { isTauri?: boolean }).isTauri,
}));

beforeEach(() => {
  mockCheck.mockReset();
  mockRelaunch.mockReset();
  (globalThis as unknown as { isTauri?: boolean }).isTauri = true;
});

afterEach(() => {
  delete (globalThis as unknown as { isTauri?: boolean }).isTauri;
});

function buildUpdate(overrides: Partial<MockUpdate> = {}): MockUpdate {
  return {
    available: true,
    version: "0.1.1",
    body: "Test notes",
    date: "2026-05-16",
    downloadAndInstall: vi.fn(),
    ...overrides,
  };
}

describe("useUpdater", () => {
  it("idle when auto check is disabled", () => {
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    expect(result.current.state.kind).toBe("idle");
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("runs check on mount when autoCheckOnMount is true", async () => {
    mockCheck.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: true }));
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.state.kind).toBe("upToDate"));
  });

  it("transitions to upToDate when check returns null", async () => {
    mockCheck.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state.kind).toBe("upToDate");
  });

  it("transitions to upToDate when check returns Update with available=false", async () => {
    mockCheck.mockResolvedValueOnce(buildUpdate({ available: false }));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state.kind).toBe("upToDate");
  });

  it("transitions to available when an update is found", async () => {
    mockCheck.mockResolvedValueOnce(buildUpdate());
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state).toEqual({
      kind: "available",
      version: "0.1.1",
      notes: "Test notes",
      date: "2026-05-16",
    });
  });

  it("transitions through downloading and readyToInstall and relaunches", async () => {
    const downloadAndInstall = vi.fn(async (cb?: (event: ProgressEvent) => void) => {
      cb?.({ event: "Started", data: { contentLength: 1000 } });
      cb?.({ event: "Progress", data: { chunkLength: 400 } });
      cb?.({ event: "Progress", data: { chunkLength: 600 } });
      cb?.({ event: "Finished" });
    });
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));
    mockRelaunch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state.kind).toBe("available");

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    // After the callback's Finished event the state is readyToInstall, and
    // since downloadAndInstall resolves immediately after, relaunch is
    // called once.
    expect(result.current.state).toEqual({ kind: "readyToInstall", version: "0.1.1" });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("does not relaunch until downloadAndInstall resolves, not merely on Finished", async () => {
    // Guards CLAUDE.md self-update invariant 7. `Finished` only means the
    // download ended — the install is still running — so moving relaunch()
    // into the progress callback would kill the process mid-install. The
    // mock therefore stays pending after emitting Finished.
    let finishInstall: (() => void) | undefined;
    const downloadAndInstall = vi.fn(async (cb?: (event: ProgressEvent) => void) => {
      cb?.({ event: "Started", data: { contentLength: 1000 } });
      cb?.({ event: "Progress", data: { chunkLength: 1000 } });
      cb?.({ event: "Finished" });
      await new Promise<void>((resolve) => {
        finishInstall = resolve;
      });
    });
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));
    mockRelaunch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates("auto");
    });

    let installed: Promise<void> | undefined;
    act(() => {
      installed = result.current.downloadAndInstall();
    });
    await waitFor(() => expect(result.current.state.kind).toBe("readyToInstall"));
    expect(mockRelaunch).not.toHaveBeenCalled();

    await act(async () => {
      finishInstall?.();
      await installed;
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("parks the update instead of relaunching when canRelaunch says no", async () => {
    // Regression guard for both the guard itself and the ref mirroring behind
    // it. `canRelaunch` is passed as a fresh closure per render — exactly how
    // App does it, closing over that render's `shapes` — and the shape is
    // added mid-install. Reading a captured first-render callback instead of
    // the latest one would answer "no shapes" and relaunch, losing the work.
    let finishInstall: (() => void) | undefined;
    const downloadAndInstall = vi.fn(async (cb?: (event: ProgressEvent) => void) => {
      cb?.({ event: "Finished" });
      await new Promise<void>((resolve) => {
        finishInstall = resolve;
      });
    });
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));

    const { result, rerender } = renderHook(
      ({ hasShapes }: { hasShapes: boolean }) =>
        useUpdater({ autoCheckOnMount: false, canRelaunch: () => !hasShapes }),
      { initialProps: { hasShapes: false } },
    );
    await act(async () => {
      await result.current.checkForUpdates("auto");
    });

    let installed: Promise<void> | undefined;
    act(() => {
      installed = result.current.downloadAndInstall();
    });
    await waitFor(() => expect(result.current.state.kind).toBe("readyToInstall"));

    // The user draws something while the install is still running.
    rerender({ hasShapes: true });

    await act(async () => {
      finishInstall?.();
      await installed;
    });

    expect(mockRelaunch).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "awaitingRelaunch", version: "0.1.1" });

    // The user finishes the update explicitly once the work is dealt with.
    mockRelaunch.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.relaunchNow();
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  // Structural regression guard. A behavioural test cannot cover this: after
  // the first load the module is cached, so `await import(...)` collapses to a
  // single microtask, and any test that tries to interleave a render there
  // would depend on microtask ordering and flake. We assert the source layout
  // instead — the process module must be loaded BEFORE the guard runs, so no
  // await separates the decision from the relaunch. In the real app that
  // window is a chunk fetch, long enough for a `mouseup` to commit a shape
  // that the already-authorised relaunch would then destroy.
  it("loads the process module before consulting canRelaunch (structural)", () => {
    expect(useUpdaterSource).toMatch(
      /const \{ relaunch \} = await import\("@tauri-apps\/plugin-process"\);\s*if \(canRelaunchRef\.current\?\.\(\) === false\) \{[\s\S]*?\}\s*await relaunch\(\);/,
    );
  });

  it("relaunches directly when canRelaunch allows it", async () => {
    const downloadAndInstall = vi.fn(async (cb?: (event: ProgressEvent) => void) => {
      cb?.({ event: "Finished" });
    });
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));
    mockRelaunch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useUpdater({ autoCheckOnMount: false, canRelaunch: () => true })
    );
    await act(async () => {
      await result.current.checkForUpdates("auto");
    });
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("transitions to error when check fails and records the manual origin", async () => {
    mockCheck.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates("manual");
    });
    expect(result.current.state).toEqual({
      kind: "error",
      message: "network down",
      origin: "manual",
    });
  });

  it("records the auto origin when the startup check fails", async () => {
    // The origin is what keeps a failed startup check silent in the UI.
    mockCheck.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: true }));
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    expect(result.current.state).toEqual({
      kind: "error",
      message: "network down",
      origin: "auto",
    });
  });

  it("defaults the origin to manual when called without an argument", async () => {
    mockCheck.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state).toMatchObject({ origin: "manual" });
  });

  it("returns the outcome of the check to the caller", async () => {
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));

    mockCheck.mockResolvedValueOnce(null);
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdates("manual");
    });
    expect(outcome).toBe("upToDate");

    mockCheck.mockRejectedValueOnce(new Error("network down"));
    await act(async () => {
      outcome = await result.current.checkForUpdates("manual");
    });
    expect(outcome).toBe("error");

    mockCheck.mockResolvedValueOnce(buildUpdate());
    await act(async () => {
      outcome = await result.current.checkForUpdates("manual");
    });
    expect(outcome).toBe("available");
  });

  it("skips the request and reports available when an update is already known", async () => {
    // Regression guard: the catch below clears `updateRef`, so a failing
    // re-check would drop an update the user has already been shown.
    mockCheck.mockResolvedValueOnce(buildUpdate());
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates("auto");
    });
    expect(mockCheck).toHaveBeenCalledTimes(1);

    mockCheck.mockRejectedValueOnce(new Error("network down"));
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdates("manual");
    });

    expect(outcome).toBe("available");
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(result.current.state.kind).toBe("available");

    // The cached Update survived, so installing still works.
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("discards a stale check that resolves after a newer one", async () => {
    // Regression guard: the startup auto-check can still be in flight when
    // the user triggers a manual check. A late auto-check failure must not
    // overwrite the newer result or clear the cached Update.
    // Hand out a deferred per call so the two checks can be settled in the
    // opposite order from which they started — the whole point of the guard.
    const pending: { resolve: (value: unknown) => void; reject: (err: Error) => void }[] = [];
    mockCheck.mockImplementation(() =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      })
    );
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));

    let autoOutcome: Promise<string> | undefined;
    act(() => {
      autoOutcome = result.current.checkForUpdates("auto");
    });
    await waitFor(() => expect(pending).toHaveLength(1));

    let manualOutcome: Promise<string> | undefined;
    act(() => {
      manualOutcome = result.current.checkForUpdates("manual");
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    // The newer manual check lands first and finds an update.
    await act(async () => {
      pending[1]?.resolve(buildUpdate());
      expect(await manualOutcome).toBe("available");
    });
    expect(result.current.state.kind).toBe("available");

    // The stale auto check then fails. Without the guard this would flip the
    // state to a silent error and null out the cached Update.
    await act(async () => {
      pending[0]?.reject(new Error("network down"));
      expect(await autoOutcome).toBe("idle");
    });

    expect(result.current.state.kind).toBe("available");
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("transitions to error when downloadAndInstall fails", async () => {
    const downloadAndInstall = vi.fn(async () => {
      throw new Error("signature mismatch");
    });
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(result.current.state).toEqual({
      kind: "error",
      message: "signature mismatch",
      origin: "install",
    });
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it("keeps the cached update after a failed install so a retry can reuse it", async () => {
    const downloadAndInstall = vi.fn()
      .mockRejectedValueOnce(new Error("signature mismatch"))
      .mockResolvedValueOnce(undefined);
    mockCheck.mockResolvedValueOnce(buildUpdate({ downloadAndInstall }));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates("auto");
    });
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(result.current.state).toMatchObject({ kind: "error", origin: "install" });

    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it("is a no-op outside Tauri", async () => {
    (globalThis as unknown as { isTauri?: boolean }).isTauri = false;
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: true }));
    // Yield twice so any pending microtasks settle.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.state.kind).toBe("idle");

    // The `idle` member of CheckResult exists for exactly this branch: a
    // bare `return` would make the declared return type unsatisfiable.
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.checkForUpdates("manual");
    });
    expect(outcome).toBe("idle");
  });

  it("downloadAndInstall without a cached update transitions to error", async () => {
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(result.current.state).toMatchObject({ kind: "error", origin: "install" });
  });
});
