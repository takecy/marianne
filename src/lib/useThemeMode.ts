import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() =>
    window.matchMedia(QUERY).matches ? "dark" : "light"
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => {
      setMode(event.matches ? "dark" : "light");
    };

    // Safari < 14 / WKWebView on macOS 10.13–10.15 — within Tauri v2's default
    // `bundle.macOS.minimumSystemVersion` — only ship the deprecated addListener
    // API. Falling back keeps the effect from throwing on those builds.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return mode;
}
