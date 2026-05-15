import { useEffect, useState } from "react";
import type { ImageSource, LoadedImage } from "@/types/image";

interface UseImageLoaderOptions {
  onImageLoaded: (image: LoadedImage) => void;
  onError?: (message: string) => void;
}

interface UseImageLoaderResult {
  isDraggingOver: boolean;
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

function decodeImageFile(
  file: File,
  source: ImageSource,
  onImageLoaded: (image: LoadedImage) => void,
  onError: ((message: string) => void) | undefined,
): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    onImageLoaded({
      element: img,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      source,
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

    window.addEventListener("paste", handlePaste);
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
