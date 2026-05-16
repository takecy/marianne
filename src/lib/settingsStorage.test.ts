import { afterEach, beforeEach, vi } from "vitest";
import { loadLastSaveDirectory, saveLastSaveDirectory } from "@/lib/settingsStorage";

describe("settingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when no value has been stored", () => {
    expect(loadLastSaveDirectory()).toBeUndefined();
  });

  it("round-trips a directory through save and load", () => {
    saveLastSaveDirectory("/Users/test/Pictures");
    expect(loadLastSaveDirectory()).toBe("/Users/test/Pictures");
  });

  it("overwrites a previously stored value", () => {
    saveLastSaveDirectory("/tmp/first");
    saveLastSaveDirectory("/tmp/second");
    expect(loadLastSaveDirectory()).toBe("/tmp/second");
  });

  it("returns undefined when localStorage.getItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(loadLastSaveDirectory()).toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("silently ignores localStorage.setItem failures", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    // Should not throw.
    expect(() => saveLastSaveDirectory("/tmp/whatever")).not.toThrow();
    expect(spy).toHaveBeenCalledWith("marianne.lastSaveDir", "/tmp/whatever");
  });
});
