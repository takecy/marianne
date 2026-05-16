// Lightweight localStorage wrapper for "last save directory" persistence.
// Wrapped in try/catch so jsdom/SSR or quota-exceeded environments do not
// crash the app — a missing or unreadable setting simply falls back to
// undefined.

const LAST_SAVE_DIRECTORY_KEY = "marianne.lastSaveDir";

export function loadLastSaveDirectory(): string | undefined {
  try {
    const value = localStorage.getItem(LAST_SAVE_DIRECTORY_KEY);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveLastSaveDirectory(dir: string): void {
  try {
    localStorage.setItem(LAST_SAVE_DIRECTORY_KEY, dir);
  } catch {
    // quota exceeded, disabled storage, or running in a non-DOM context.
  }
}
