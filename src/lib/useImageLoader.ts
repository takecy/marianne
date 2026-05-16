import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { ImageSource, LoadedImage } from "@/types/image";

interface UseImageLoaderOptions {
  onImageLoaded: (image: LoadedImage) => void;
  onError?: (message: string) => void;
}

interface UseImageLoaderResult {
  isDraggingOver: boolean;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function basenameOf(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function pickPastedImageFile(items: DataTransferItemList | null | undefined): File | null {
  if (!items) {
    return null;
  }
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }
  return null;
}

function pickDroppedImageFile(files: FileList | null | undefined): File | null {
  if (!files) {
    return null;
  }
  for (const file of Array.from(files)) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }
  return null;
}

interface LoadedImageMeta {
  source: ImageSource;
  sourcePath?: string;
  sourceFileName?: string;
}

function decodeImageFromObjectUrl(
  url: string,
  meta: LoadedImageMeta,
  onImageLoaded: (image: LoadedImage) => void,
  onError: ((message: string) => void) | undefined,
): void {
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    onImageLoaded({
      element: img,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      ...meta,
    });
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    const message = "画像の読み込みに失敗しました";
    if (onError) {
      onError(message);
    } else {
      console.error(message);
    }
  };
  img.src = url;
}

function decodeImageFile(
  file: File,
  source: ImageSource,
  onImageLoaded: (image: LoadedImage) => void,
  onError: ((message: string) => void) | undefined,
): void {
  const url = URL.createObjectURL(file);
  decodeImageFromObjectUrl(
    url,
    { source, sourceFileName: file.name || undefined },
    onImageLoaded,
    onError,
  );
}

// Shared decoder for any Tauri-side filesystem path (drag-drop or "Open
// With"). The trust boundary (extension whitelist, symlink rejection) lives
// in Rust; `isImagePath` below acts as defense in depth on the frontend
// side. `readFile` succeeds because Rust calls `scope.allow_file(path)` for
// each accepted path before emitting / queueing it.
async function decodeTauriFilePath(
  path: string,
  source: ImageSource,
  onImageLoaded: (image: LoadedImage) => void,
  onError: ((message: string) => void) | undefined,
): Promise<void> {
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    decodeImageFromObjectUrl(
      url,
      { source, sourcePath: path, sourceFileName: basenameOf(path) },
      onImageLoaded,
      onError,
    );
  } catch (err) {
    const message = "画像の読み込みに失敗しました";
    if (onError) {
      onError(message);
    } else {
      console.error(message, err);
    }
  }
}

export function useImageLoader(options: UseImageLoaderOptions): UseImageLoaderResult {
  const { onImageLoaded, onError } = options;
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = pickPastedImageFile(event.clipboardData?.items);
      if (!file) {
        return;
      }
      event.preventDefault();
      decodeImageFile(file, "paste", onImageLoaded, onError);
    };

    window.addEventListener("paste", handlePaste);

    // In a Tauri runtime, subscribe to native drag-drop so we can capture
    // the absolute filesystem path and default the save dialog to the same
    // directory. The webview module is loaded via dynamic import to avoid
    // pulling Tauri-specific module init into the browser-only `pnpm dev`
    // bundle.
    if (isTauri()) {
      let unlistenDragDrop: (() => void) | undefined;
      let unlistenFileOpen: (() => void) | undefined;
      let cancelled = false;

      void (async () => {
        // (1) Cold-start drain: paths queued by `RunEvent::Opened` before
        // this hook had a chance to subscribe (e.g. when the user starts
        // marianne via macOS "Open With" while the app was not running).
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const pending = await invoke<string[]>("take_pending_open_paths");
          if (!cancelled) {
            const head = pending.find(isImagePath);
            if (head) {
              void decodeTauriFilePath(head, "file", onImageLoaded, onError);
            }
          }
        } catch (err) {
          console.error("Failed to drain pending open paths:", err);
        }

        // (2) Warm-start listen: when the app is already running and the
        // user picks "Open With > Marianne" on another file, Rust emits
        // `file-open-requested` with the (already vetted) path list.
        try {
          const { listen } = await import("@tauri-apps/api/event");
          const fn = await listen<string[]>("file-open-requested", (event) => {
            const head = event.payload.find(isImagePath);
            if (head) {
              void decodeTauriFilePath(head, "file", onImageLoaded, onError);
            }
          });
          if (cancelled) {
            fn();
          } else {
            unlistenFileOpen = fn;
          }
        } catch (err) {
          console.error("Failed to subscribe to file-open-requested:", err);
        }

        // (3) Tauri native drag-drop. Kept as the third subscription so the
        // user can drag images onto the window even after an "Open With"
        // session has been started.
        try {
          const { getCurrentWebview } = await import("@tauri-apps/api/webview");
          const fn = await getCurrentWebview().onDragDropEvent((event) => {
            const payload = event.payload;
            if (payload.type === "enter" || payload.type === "over") {
              setIsDraggingOver(true);
            } else if (payload.type === "leave") {
              setIsDraggingOver(false);
            } else if (payload.type === "drop") {
              setIsDraggingOver(false);
              const imagePath = payload.paths.find(isImagePath);
              if (imagePath) {
                void decodeTauriFilePath(imagePath, "drop", onImageLoaded, onError);
              }
            }
          });
          if (cancelled) {
            fn();
          } else {
            unlistenDragDrop = fn;
          }
        } catch (err) {
          console.error("Failed to subscribe to Tauri drag-drop event:", err);
        }
      })();

      return () => {
        cancelled = true;
        unlistenDragDrop?.();
        unlistenFileOpen?.();
        window.removeEventListener("paste", handlePaste);
      };
    }

    // Browser fallback (used by `pnpm dev` outside Tauri). Web drag-drop
    // cannot expose the absolute file path; we only get File.name as a
    // best-effort source filename and leave sourcePath undefined.
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (event.target === document.documentElement || event.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);
      const file = pickDroppedImageFile(event.dataTransfer?.files);
      if (!file) {
        return;
      }
      decodeImageFile(file, "drop", onImageLoaded, onError);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onImageLoaded, onError]);

  return { isDraggingOver };
}
