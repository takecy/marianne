import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { forwardRef, useEffect, useRef } from "react";
import { Image as KonvaImage } from "react-konva";

// Target pixel block size measured in image natural coordinates.
// CanvasArea converts to cached-canvas (screen) units via imageToScreenScale.
export const MOSAIC_NATURAL_PIXEL_SIZE = 24;

interface MosaicNodeProps {
  image: HTMLImageElement;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  pixelSize: number;
  isSelectMode?: boolean;
  onClick?: () => void;
  onTap?: () => void;
  onDragStart?: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (event: KonvaEventObject<Event>) => void;
}

function setRef<T>(ref: React.Ref<T> | null | undefined, value: T | null): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export const MosaicNode = forwardRef<Konva.Image, MosaicNodeProps>(
  function MosaicNode(props, externalRef) {
    const innerRef = useRef<Konva.Image | null>(null);

    useEffect(() => {
      const node = innerRef.current;
      if (!node) {
        return;
      }
      node.cache();
      node.getLayer()?.batchDraw();
    }, [
      props.image,
      props.cropX,
      props.cropY,
      props.cropWidth,
      props.cropHeight,
      props.screenWidth,
      props.screenHeight,
      props.pixelSize,
    ]);

    return (
      <KonvaImage
        ref={(node) => {
          innerRef.current = node;
          setRef(externalRef, node);
        }}
        image={props.image}
        x={props.screenX}
        y={props.screenY}
        width={props.screenWidth}
        height={props.screenHeight}
        crop={{
          x: props.cropX,
          y: props.cropY,
          width: props.cropWidth,
          height: props.cropHeight,
        }}
        filters={[Konva.Filters.Pixelate]}
        pixelSize={props.pixelSize}
        listening={props.isSelectMode ?? false}
        draggable={props.isSelectMode ?? false}
        onClick={props.onClick}
        onTap={props.onTap}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        onTransformEnd={props.onTransformEnd}
      />
    );
  },
);
