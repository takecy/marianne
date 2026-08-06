import { deriveUpdateNotice } from "@/lib/updateNotice";

describe("deriveUpdateNotice", () => {
  it("renders nothing while idle", () => {
    expect(deriveUpdateNotice({ kind: "idle" })).toBeNull();
  });

  it("renders nothing while checking", () => {
    expect(deriveUpdateNotice({ kind: "checking" })).toBeNull();
  });

  it("renders nothing when already up to date", () => {
    expect(deriveUpdateNotice({ kind: "upToDate" })).toBeNull();
  });

  it("surfaces the version when an update is available", () => {
    expect(deriveUpdateNotice({ kind: "available", version: "0.3.6" })).toEqual({
      kind: "available",
      version: "0.3.6",
    });
  });

  it("computes a rounded percentage while downloading", () => {
    expect(
      deriveUpdateNotice({ kind: "downloading", downloaded: 4500, contentLength: 10_000 }),
    ).toEqual({ kind: "downloading", percent: 45 });
  });

  it("reports an unknown percentage when contentLength is missing", () => {
    expect(deriveUpdateNotice({ kind: "downloading", downloaded: 4500 })).toEqual({
      kind: "downloading",
      percent: null,
    });
  });

  it("reports an unknown percentage when contentLength is zero", () => {
    // Guards against a divide-by-zero producing Infinity in the label.
    expect(
      deriveUpdateNotice({ kind: "downloading", downloaded: 0, contentLength: 0 }),
    ).toEqual({ kind: "downloading", percent: null });
  });

  it("clamps the percentage at 100 when more bytes arrive than announced", () => {
    expect(
      deriveUpdateNotice({ kind: "downloading", downloaded: 12_000, contentLength: 10_000 }),
    ).toEqual({ kind: "downloading", percent: 100 });
  });

  it("switches to the installing label once the download finished", () => {
    expect(deriveUpdateNotice({ kind: "readyToInstall", version: "0.3.6" })).toEqual({
      kind: "installing",
    });
  });

  it("offers a restart when the relaunch was held back", () => {
    expect(deriveUpdateNotice({ kind: "awaitingRelaunch", version: "0.3.6" })).toEqual({
      kind: "relaunch",
    });
  });

  it("stays silent for an automatic check failure", () => {
    // Offline is the normal case for an offline-first app, so a failed
    // startup check must not put anything in the corner.
    expect(deriveUpdateNotice({ kind: "error", message: "offline", origin: "auto" })).toBeNull();
  });

  it("stays silent for a manual check failure (the StatusBar reports it)", () => {
    // Showing the bell here would claim "an update exists" when the check
    // never concluded.
    expect(deriveUpdateNotice({ kind: "error", message: "offline", origin: "manual" })).toBeNull();
  });

  it("surfaces an install failure so the user can retry", () => {
    expect(
      deriveUpdateNotice({ kind: "error", message: "signature mismatch", origin: "install" }),
    ).toEqual({ kind: "failed", message: "signature mismatch" });
  });
});
