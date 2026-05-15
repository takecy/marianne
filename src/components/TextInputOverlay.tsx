import { useEffect, useRef, useState } from "react";
import { colorHex } from "@/types/tool";
import type { ColorPresetName } from "@/types/tool";
import styles from "./TextInputOverlay.module.css";

interface TextInputOverlayProps {
  x: number;
  y: number;
  color: ColorPresetName;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function TextInputOverlay(props: TextInputOverlayProps) {
  const { x, y, color, onConfirm, onCancel } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const finalizedRef = useRef<boolean>(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    textareaRef.current?.focus();
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

  const handleBlur = () => {
    finalize("confirm", value);
  };

  return (
    <textarea
      ref={textareaRef}
      className={styles.textInput}
      style={{ left: x, top: y, color: colorHex(color) }}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      rows={1}
      aria-label="テキスト入力"
    />
  );
}
