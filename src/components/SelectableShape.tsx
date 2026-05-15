import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Line, Rect, Text } from "react-konva";
import { imageToScreen, imageToScreenScale, screenToImage } from "@/lib/imageFit";
import type { FitRect, Size as FitSize } from "@/lib/imageFit";
import type { LoadedImage } from "@/types/image";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";
import { colorHex } from "@/types/tool";
import {
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  ARROW_NECK_HALF_WIDTH,
  ARROW_NECK_LENGTH,
  ARROW_TAIL_HALF_WIDTH,
  SHAPE_STROKE_WIDTH,
  TEXT_FONT_SIZE,
  TEXT_FONT_STYLE,
  TEXT_SHADOW_BLUR,
  TEXT_SHADOW_COLOR,
  TEXT_SHADOW_OFFSET_X,
  TEXT_SHADOW_OFFSET_Y,
  TEXT_STROKE_COLOR,
  TEXT_STROKE_WIDTH,
} from "@/constants/shape";
import { computeArrowPolygon } from "@/lib/arrowGeometry";
import { MOSAIC_NATURAL_PIXEL_SIZE, MosaicNode } from "./MosaicNode";

type RectPatch = Partial<Omit<RectShape, "id" | "type">>;
type TextPatch = Partial<Omit<TextShape, "id" | "type">>;
type ArrowPatch = Partial<Omit<ArrowShape, "id" | "type">>;
type MosaicPatch = Partial<Omit<MosaicShape, "id" | "type">>;

interface SelectableShapeProps {
  shape: Shape;
  fit: FitRect;
  imageSize: FitSize;
  image: LoadedImage | null;
  isSelectMode: boolean;
  onSelect: (id: string) => void;
  onUpdateRect: (id: string, patch: RectPatch) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onUpdateArrow: (id: string, patch: ArrowPatch) => void;
  onUpdateMosaic: (id: string, patch: MosaicPatch) => void;
  registerNode: (id: string, node: Konva.Node | null) => void;
}

export function SelectableShape(props: SelectableShapeProps) {
  const {
    shape,
    fit,
    imageSize,
    image,
    isSelectMode,
    onSelect,
    onUpdateRect,
    onUpdateText,
    onUpdateArrow,
    onUpdateMosaic,
    registerNode,
  } = props;
  const ref = useRef<Konva.Node | null>(null);
  const { scaleX: imgScaleX, scaleY: imgScaleY } = imageToScreenScale(fit, imageSize);

  useEffect(() => {
    registerNode(shape.id, ref.current);
    return () => registerNode(shape.id, null);
  }, [shape.id, registerNode]);

  const handleSelect = () => onSelect(shape.id);

  if (shape.type === "rect") {
    const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
    return (
      <Rect
        ref={(node) => {
          ref.current = node;
        }}
        listening={isSelectMode}
        draggable={isSelectMode}
        onClick={handleSelect}
        onTap={handleSelect}
        x={topLeft.x}
        y={topLeft.y}
        width={shape.width * imgScaleX}
        height={shape.height * imgScaleY}
        stroke={colorHex(shape.color)}
        strokeWidth={SHAPE_STROKE_WIDTH}
        lineJoin="round"
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const node = event.target;
          const imgPt = screenToImage({ x: node.x(), y: node.y() }, fit, imageSize);
          onUpdateRect(shape.id, { x: imgPt.x, y: imgPt.y });
        }}
        onTransformEnd={(event: KonvaEventObject<Event>) => {
          const node = event.target as Konva.Rect;
          const newScreenWidth = Math.abs(node.width() * node.scaleX());
          const newScreenHeight = Math.abs(node.height() * node.scaleY());
          if (newScreenWidth < 1 || newScreenHeight < 1) {
            node.scaleX(1);
            node.scaleY(1);
            return;
          }
          const imgPt = screenToImage({ x: node.x(), y: node.y() }, fit, imageSize);
          onUpdateRect(shape.id, {
            x: imgPt.x,
            y: imgPt.y,
            width: newScreenWidth / imgScaleX,
            height: newScreenHeight / imgScaleY,
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
    );
  }

  if (shape.type === "text") {
    const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
    const fontScale = Math.min(imgScaleX, imgScaleY);
    return (
      <Text
        ref={(node) => {
          ref.current = node;
        }}
        listening={isSelectMode}
        draggable={isSelectMode}
        onClick={handleSelect}
        onTap={handleSelect}
        x={topLeft.x}
        y={topLeft.y}
        text={shape.text}
        fontSize={TEXT_FONT_SIZE * fontScale}
        fontStyle={TEXT_FONT_STYLE}
        fontFamily="sans-serif"
        fill={colorHex(shape.color)}
        stroke={TEXT_STROKE_COLOR}
        strokeWidth={TEXT_STROKE_WIDTH * fontScale}
        lineJoin="round"
        fillAfterStrokeEnabled
        shadowColor={TEXT_SHADOW_COLOR}
        shadowBlur={TEXT_SHADOW_BLUR * fontScale}
        shadowOffsetX={TEXT_SHADOW_OFFSET_X * fontScale}
        shadowOffsetY={TEXT_SHADOW_OFFSET_Y * fontScale}
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const imgPt = screenToImage(
            { x: event.target.x(), y: event.target.y() },
            fit,
            imageSize,
          );
          onUpdateText(shape.id, { x: imgPt.x, y: imgPt.y });
        }}
      />
    );
  }

  if (shape.type === "arrow") {
    const from = imageToScreen({ x: shape.fromX, y: shape.fromY }, fit, imageSize);
    const to = imageToScreen({ x: shape.toX, y: shape.toY }, fit, imageSize);
    const arrowScale = Math.min(imgScaleX, imgScaleY);
    const polygon = computeArrowPolygon(from, to, {
      tailHalfWidth: ARROW_TAIL_HALF_WIDTH * arrowScale,
      neckHalfWidth: ARROW_NECK_HALF_WIDTH * arrowScale,
      headHalfWidth: ARROW_HEAD_HALF_WIDTH * arrowScale,
      neckLength: ARROW_NECK_LENGTH * arrowScale,
      headLength: ARROW_HEAD_LENGTH * arrowScale,
    });
    return (
      <Line
        ref={(node) => {
          ref.current = node;
        }}
        listening={isSelectMode}
        draggable={isSelectMode}
        onClick={handleSelect}
        onTap={handleSelect}
        points={polygon}
        closed
        fill={colorHex(shape.color)}
        shadowBlur={6 * arrowScale}
        shadowColor="rgba(0,0,0,0.45)"
        shadowOffsetX={1 * arrowScale}
        shadowOffsetY={2 * arrowScale}
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const node = event.target;
          const dx = node.x();
          const dy = node.y();
          node.x(0);
          node.y(0);
          const newFrom = screenToImage(
            { x: from.x + dx, y: from.y + dy },
            fit,
            imageSize,
          );
          const newTo = screenToImage(
            { x: to.x + dx, y: to.y + dy },
            fit,
            imageSize,
          );
          onUpdateArrow(shape.id, {
            fromX: newFrom.x,
            fromY: newFrom.y,
            toX: newTo.x,
            toY: newTo.y,
          });
        }}
      />
    );
  }

  // mosaic
  if (!image) {
    return null;
  }
  const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
  const pixelSize = MOSAIC_NATURAL_PIXEL_SIZE * Math.min(imgScaleX, imgScaleY);
  return (
    <MosaicNode
      ref={(node) => {
        ref.current = node;
      }}
      image={image.element}
      screenX={topLeft.x}
      screenY={topLeft.y}
      screenWidth={shape.width * imgScaleX}
      screenHeight={shape.height * imgScaleY}
      cropX={shape.x}
      cropY={shape.y}
      cropWidth={shape.width}
      cropHeight={shape.height}
      pixelSize={pixelSize}
      isSelectMode={isSelectMode}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragEnd={(event: KonvaEventObject<DragEvent>) => {
        const imgPt = screenToImage(
          { x: event.target.x(), y: event.target.y() },
          fit,
          imageSize,
        );
        onUpdateMosaic(shape.id, { x: imgPt.x, y: imgPt.y });
      }}
      onTransformEnd={(event: KonvaEventObject<Event>) => {
        const node = event.target as Konva.Image;
        const newScreenWidth = Math.abs(node.width() * node.scaleX());
        const newScreenHeight = Math.abs(node.height() * node.scaleY());
        if (newScreenWidth < 1 || newScreenHeight < 1) {
          node.scaleX(1);
          node.scaleY(1);
          return;
        }
        const imgPt = screenToImage({ x: node.x(), y: node.y() }, fit, imageSize);
        onUpdateMosaic(shape.id, {
          x: imgPt.x,
          y: imgPt.y,
          width: newScreenWidth / imgScaleX,
          height: newScreenHeight / imgScaleY,
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
}
