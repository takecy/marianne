import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Rect, Text } from "react-konva";
import { imageToScreen, imageToScreenScale, screenToImage } from "@/lib/imageFit";
import type { FitRect, Size as FitSize } from "@/lib/imageFit";
import type { LoadedImage } from "@/types/image";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";
import { colorHex, strokeWidthValue, textStrokeColorFor } from "@/types/tool";
import {
  TEXT_FONT_SIZE,
  TEXT_FONT_SIZE_MIN,
  TEXT_FONT_STYLE,
  TEXT_SHADOW_BLUR,
  TEXT_SHADOW_COLOR,
  TEXT_SHADOW_OFFSET_X,
  TEXT_SHADOW_OFFSET_Y,
  TEXT_STROKE_WIDTH,
} from "@/constants/shape";
import { ArrowShapeNode } from "./ArrowShapeNode";
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
  // Whether this shape is the currently selected one. Used by the arrow
  // branch to render endpoint drag handles; other shape types ignore it
  // because the Konva.Transformer in CanvasArea handles their selection UI.
  isSelected: boolean;
  // Text-only: hides the Konva text node while the edit overlay is active
  // so the rendered text and the textarea do not double up. CanvasArea
  // owns editingTextId and passes the derived flag down.
  isEditing: boolean;
  onSelect: (id: string) => void;
  onStartEditText: (id: string) => void;
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
    isSelected,
    isEditing,
    onSelect,
    onStartEditText,
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
        strokeWidth={strokeWidthValue(shape.strokeWidth ?? "thick")}
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
    const baseFontSize = shape.fontSize ?? TEXT_FONT_SIZE;
    const fontSizeRatio = baseFontSize / TEXT_FONT_SIZE;
    return (
      <Text
        ref={(node) => {
          ref.current = node;
        }}
        listening={isSelectMode}
        draggable={isSelectMode}
        visible={!isEditing}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={() => onStartEditText(shape.id)}
        onDblTap={() => onStartEditText(shape.id)}
        x={topLeft.x}
        y={topLeft.y}
        text={shape.text}
        fontSize={baseFontSize * fontScale}
        fontStyle={TEXT_FONT_STYLE}
        fontFamily="sans-serif"
        fill={colorHex(shape.color)}
        stroke={textStrokeColorFor(shape.color)}
        strokeWidth={TEXT_STROKE_WIDTH * fontSizeRatio * fontScale}
        lineJoin="round"
        fillAfterStrokeEnabled
        shadowColor={TEXT_SHADOW_COLOR}
        shadowBlur={TEXT_SHADOW_BLUR * fontSizeRatio * fontScale}
        shadowOffsetX={TEXT_SHADOW_OFFSET_X * fontSizeRatio * fontScale}
        shadowOffsetY={TEXT_SHADOW_OFFSET_Y * fontSizeRatio * fontScale}
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const imgPt = screenToImage(
            { x: event.target.x(), y: event.target.y() },
            fit,
            imageSize,
          );
          onUpdateText(shape.id, { x: imgPt.x, y: imgPt.y });
        }}
        onTransformEnd={(event: KonvaEventObject<Event>) => {
          const node = event.target as Konva.Text;
          // keepRatio: true so scaleX === scaleY.
          const scale = node.scaleX();
          const newFontSize = baseFontSize * scale;
          if (newFontSize < TEXT_FONT_SIZE_MIN) {
            // Below threshold: reset scale AND restore node x/y from shape
            // values so Konva.Transformer's transient position write does
            // not leak into the next render.
            node.scaleX(1);
            node.scaleY(1);
            const shapeScreen = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
            node.x(shapeScreen.x);
            node.y(shapeScreen.y);
            return;
          }
          const imgPt = screenToImage({ x: node.x(), y: node.y() }, fit, imageSize);
          onUpdateText(shape.id, {
            x: imgPt.x,
            y: imgPt.y,
            fontSize: newFontSize,
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
    );
  }

  if (shape.type === "arrow") {
    return (
      <ArrowShapeNode
        shape={shape}
        fit={fit}
        imageSize={imageSize}
        isSelectMode={isSelectMode}
        isSelected={isSelected}
        onSelect={onSelect}
        onUpdateArrow={onUpdateArrow}
        registerNode={registerNode}
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
