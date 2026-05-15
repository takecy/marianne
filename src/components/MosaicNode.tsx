import Konva from "konva";
import { useEffect, useRef } from "react";
import { Image as KonvaImage } from "react-konva";

// Target pixel block size measured in image natural coordinates.
// CanvasArea converts to cached-canvas (screen) units via imageToScreenScale.
export const MOSAIC_NATURAL_PIXEL_SIZE = 16;

interface MosaicNodeProps {
  image: HTMLImageElement;
  // Screen coordinates: where the cached image is drawn on the Stage.
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  // Image natural coordinates: which part of the source image to crop.
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  // pixelSize is expressed in cached-canvas (screen) units. CanvasArea computes
  // it as MOSAIC_NATURAL_PIXEL_SIZE * Math.min(scaleX, scaleY) so the perceived
  // block size remains constant in image-natural coordinates across resize.
  pixelSize: number;
}

export function MosaicNode(props: MosaicNodeProps) {
  const ref = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = ref.current;
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
      ref={ref}
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
      listening={false}
    />
  );
}
