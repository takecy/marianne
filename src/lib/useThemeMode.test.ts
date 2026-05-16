import { act, renderHook } from "@testing-library/react";
import { useThemeMode } from "./useThemeMode";

type MqlListener = (event: { matches: boolean }) => void;

interface FakeMql {
  matches: boolean;
  listeners: Set<MqlListener>;
  addEventListener?: (type: "change", listener: MqlListener) => void;
  removeEventListener?: (type: "change", listener: MqlListener) => void;
  addListener?: (listener: MqlListener) => void;
  removeListener?: (listener: MqlListener) => void;
}

function createModernMql(initial: boolean): FakeMql {
  const listeners = new Set<MqlListener>();
  return {
    matches: initial,
    listeners,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
}

function createLegacyMql(initial: boolean): FakeMql {
  const listeners = new Set<MqlListener>();
  return {
    matches: initial,
    listeners,
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
  };
}

function installMatchMedia(mql: FakeMql) {
  Object.defineProperty(window, "matchMedia", {
    value: () => mql,
    configurable: true,
    writable: true,
  });
}

function emitChange(mql: FakeMql, matches: boolean) {
  mql.matches = matches;
  for (const listener of mql.listeners) {
    listener({ matches });
  }
}

describe("useThemeMode", () => {
  it("returns 'light' when prefers-color-scheme is not dark", () => {
    installMatchMedia(createModernMql(false));
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("light");
  });

  it("returns 'dark' when prefers-color-scheme is dark on mount", () => {
    installMatchMedia(createModernMql(true));
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("dark");
  });

  it("updates the mode when matchMedia emits a change event (modern API)", () => {
    const mql = createModernMql(false);
    installMatchMedia(mql);
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("light");

    act(() => emitChange(mql, true));
    expect(result.current).toBe("dark");

    act(() => emitChange(mql, false));
    expect(result.current).toBe("light");
  });

  it("falls back to addListener for Safari < 14 / older WKWebView", () => {
    const mql = createLegacyMql(false);
    installMatchMedia(mql);
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe("light");

    act(() => emitChange(mql, true));
    expect(result.current).toBe("dark");
  });

  it("removes the listener on unmount (modern API)", () => {
    const mql = createModernMql(false);
    installMatchMedia(mql);
    const { unmount } = renderHook(() => useThemeMode());
    expect(mql.listeners.size).toBe(1);
    unmount();
    expect(mql.listeners.size).toBe(0);
  });

  it("removes the listener on unmount (legacy API)", () => {
    const mql = createLegacyMql(false);
    installMatchMedia(mql);
    const { unmount } = renderHook(() => useThemeMode());
    expect(mql.listeners.size).toBe(1);
    unmount();
    expect(mql.listeners.size).toBe(0);
  });
});
