import { en, type TranslationKey } from "./en";

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = en[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
