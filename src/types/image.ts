export type ImageSource = "paste" | "drop";

export interface LoadedImage {
  element: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  source: ImageSource;
  // Absolute filesystem path of the source file. Populated only when the
  // image came from a Tauri native drag-drop event; absent for paste and
  // for browser-fallback Web drops.
  sourcePath?: string;
  // Basename of the source file. Populated by Tauri drag-drop (extracted
  // from sourcePath) or by the browser fallback (File.name). Used to
  // build the `<basename>_annotated.png` default export name.
  sourceFileName?: string;
}
