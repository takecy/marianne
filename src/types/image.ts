export type ImageSource = "paste" | "drop";

export interface LoadedImage {
  element: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  source: ImageSource;
}
