// "file" is for images delivered by macOS "Open With" (Launch Services /
// `RunEvent::Opened`). It has the same shape as "drop" (sourcePath +
// sourceFileName populated by Rust) but is kept as a distinct discriminator
// so callers can tell the user's intent apart from a window drag-drop.
export type ImageSource = "paste" | "drop" | "file";

export interface LoadedImage {
  element: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  source: ImageSource;
  // Absolute filesystem path of the source file. Populated for Tauri native
  // drag-drop and for macOS "Open With"; absent for paste and for
  // browser-fallback Web drops.
  sourcePath?: string;
  // Basename of the source file. Populated by Tauri drag-drop / "Open With"
  // (extracted from sourcePath) or by the browser fallback (File.name).
  // Used to build the `<basename>_annotated.png` default export name.
  sourceFileName?: string;
}
