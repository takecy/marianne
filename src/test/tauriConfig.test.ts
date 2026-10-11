import capability from "../../src-tauri/capabilities/default.json";
import tauriConfig from "../../src-tauri/tauri.conf.json";

// Guards the window chrome settings, not application code.
//
// ActionBar doubles as the macOS title bar and the window is dragged through
// `data-tauri-drag-region`. None of this is checked at build time in a way
// that fails loudly: a missing `allow-start-dragging` permission makes the
// drag silently do nothing, and dropping `titleBarStyle` brings back the
// native title bar stacked above ActionBar.

const mainWindow = tauriConfig.app.windows[0];

describe("tauri.conf.json main window", () => {
  it("overlays the title bar on the web content", () => {
    expect(mainWindow?.titleBarStyle).toBe("Overlay");
  });

  it("hides the window title", () => {
    expect(mainWindow?.hiddenTitle).toBe(true);
  });
});

describe("capabilities/default.json", () => {
  it("allows window dragging from data-tauri-drag-region", () => {
    expect(capability.permissions).toContain("core:window:allow-start-dragging");
  });
});
