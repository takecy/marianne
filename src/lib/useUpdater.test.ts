import { act, renderHook, waitFor } from "@testing-library/react";
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

  it("transitions to error when check fails", async () => {
    mockCheck.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state).toEqual({ kind: "error", message: "network down" });
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
    expect(result.current.state).toEqual({ kind: "error", message: "signature mismatch" });
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it("dismiss resets state to idle", async () => {
    mockCheck.mockResolvedValueOnce(buildUpdate());
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.state.kind).toBe("available");
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.state.kind).toBe("idle");
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
  });

  it("downloadAndInstall without a cached update transitions to error", async () => {
    const { result } = renderHook(() => useUpdater({ autoCheckOnMount: false }));
    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(result.current.state.kind).toBe("error");
  });
});
