import { t } from "./translate";

describe("t", () => {
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
