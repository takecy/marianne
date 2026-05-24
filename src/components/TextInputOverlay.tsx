import { useEffect, useRef, useState } from "react";
import { TEXT_FONT_SIZE } from "@/constants/shape";
import { t } from "@/i18n/translate";
import { colorHex } from "@/types/tool";
import type { ColorPresetName } from "@/types/tool";
import styles from "./TextInputOverlay.module.css";

interface TextInputOverlayProps {
  x: number;
  y: number;
  color: ColorPresetName;
  initialText?: string;
  fontSize?: number;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function TextInputOverlay(props: TextInputOverlayProps) {
  const { x, y, color, initialText, fontSize, onConfirm, onCancel } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const finalizedRef = useRef<boolean>(false);
  const isComposingRef = useRef<boolean>(false);
  const pendingBlurRef = useRef<boolean>(false);
  const [value, setValue] = useState(initialText ?? "");

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.focus();
    // Pre-select existing text so a typing user replaces all. Harmless for
    // the create flow (initialText empty) and required for the edit flow.
    if (node.value.length > 0) {
      node.select();
    }
  }, []);

  const finalize = (action: "confirm" | "cancel", text: string) => {
    if (finalizedRef.current) {
      return;
    }
    finalizedRef.current = true;
    if (action === "confirm" && text.length > 0) {
      onConfirm(text);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME guard: never finalize while a composition (e.g. Japanese kana →
    // kanji conversion) is in progress, so the conversion-commit Enter does
    // not close the textarea. WebKit (Tauri WKWebView) historically had
    // event-order anomalies (WebKit bug 165004), so we triangulate three
    // signals: standard nativeEvent.isComposing, legacy keyCode 229, and a
    // ref kept true across the compositionend → keydown microtask gap.
    if (
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      isComposingRef.current
    ) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finalize("confirm", value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finalize("cancel", value);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    // Keep the guard true for one microtask: WebKit can fire compositionend
    // and the conversion-commit keydown in the same task, and we must not
    // let that Enter slip through the IME guard.
    queueMicrotask(() => {
      isComposingRef.current = false;
    });
    // Recover a deferred blur: if the textarea lost focus mid-composition,
    // handleBlur stashed a pending finalize. Run it now (only if focus has
    // not returned), reading live DOM value so we do not lose characters the
    // IME committed at compositionend before React state caught up.
    if (pendingBlurRef.current) {
      pendingBlurRef.current = false;
      if (document.activeElement !== textareaRef.current) {
        finalize("confirm", textareaRef.current?.value ?? value);
      }
    }
  };

  const handleBlur = () => {
    // Defer finalize when blur fires mid-composition; otherwise the textarea
    // closes with unconfirmed IME characters. handleCompositionEnd performs
    // the recovery.
    if (isComposingRef.current) {
      pendingBlurRef.current = true;
      return;
    }
    finalize("confirm", value);
  };

  return (
    <textarea
      ref={textareaRef}
      className={styles.textInput}
      style={{ left: x, top: y, color: colorHex(color), fontSize: fontSize ?? TEXT_FONT_SIZE }}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      rows={1}
      cols={10}
      aria-label={t("textInput.label")}
    />
  );
}
