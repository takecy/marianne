import { en, type TranslationKey } from "./en";
import { ja } from "./ja";

// Locale is decided per-call so tests can override navigator.language between
// cases without rebuilding the module graph. The lookup is a cheap property
// read; no caching needed.
function dict(): Record<TranslationKey, string> {
  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("ja")
  ) {
    return ja;
  }
  return en;
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = dict()[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
