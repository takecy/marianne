import { en } from "./en";
import { ja } from "./ja";
import { t } from "./translate";

function setLocale(value: string): void {
  Object.defineProperty(navigator, "language", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("t (English locale)", () => {
  beforeEach(() => setLocale("en-US"));

  it("returns the English value for a known key without params", () => {
    expect(t("tool.select")).toBe("Select");
  });

  it("returns the template verbatim when params are omitted for an interpolated key", () => {
    expect(t("update.available.title")).toBe(
      "A new version {version} is available",
    );
  });

  it("substitutes {name} placeholders when params are provided", () => {
    expect(t("update.available.title", { version: "1.2.3" })).toBe(
      "A new version 1.2.3 is available",
    );
  });

  it("ignores extra params that do not appear in the template", () => {
    expect(t("tool.select", { version: "ignored" })).toBe("Select");
  });

  it("leaves unmatched {name} placeholders intact when the param is missing", () => {
    expect(t("update.readyToInstall.body", {})).toBe(
      "The app will restart automatically after {version} is installed.",
    );
  });

  it("coerces numeric params to strings", () => {
    expect(t("update.available.title", { version: 42 })).toBe(
      "A new version 42 is available",
    );
  });
});

describe("t (Japanese locale)", () => {
  beforeEach(() => setLocale("ja-JP"));

  it("returns the Japanese value for a known key without params", () => {
    expect(t("tool.select")).toBe("選択");
  });

  it("substitutes {name} placeholders inside a Japanese template", () => {
    expect(t("update.available.title", { version: "1.2.3" })).toBe(
      "新しいバージョン 1.2.3 が利用可能です",
    );
  });

  it("treats any navigator.language starting with 'ja' as Japanese (e.g. 'ja')", () => {
    setLocale("ja");
    expect(t("tool.select")).toBe("選択");
  });

  it("falls back to English for non-Japanese locales (e.g. 'fr-FR')", () => {
    setLocale("fr-FR");
    expect(t("tool.select")).toBe("Select");
  });
});

describe("dictionary parity", () => {
  it("ja has the same keys as en (no missing or extra translations)", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
});
