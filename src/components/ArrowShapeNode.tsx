import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef } from "react";
import { Circle, Line } from "react-konva";
import {
  ARROW_HANDLE_FILL,
  ARROW_HANDLE_RADIUS,
  ARROW_HANDLE_SHADOW_BLUR,
  ARROW_HANDLE_STROKE,
  ARROW_HANDLE_STROKE_WIDTH,
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  ARROW_NECK_HALF_WIDTH,
  ARROW_NECK_LENGTH,
  ARROW_TAIL_HALF_WIDTH,
} from "@/constants/shape";
import { computeArrowPolygon } from "@/lib/arrowGeometry";
import type { ArrowEndpoint } from "@/lib/arrowHandleDrag";
import { commitArrowEndpoint, previewArrowPolygon } from "@/lib/arrowHandleDrag";
import type { FitRect, Size as FitSize } from "@/lib/imageFit";
import { imageToScreen, imageToScreenScale, screenToImage } from "@/lib/imageFit";
import type { ArrowShape } from "@/types/shape";
import { colorHex } from "@/types/tool";

type ArrowPatch = Partial<Omit<ArrowShape, "id" | "type">>;

interface ArrowShapeNodeProps {
  shape: ArrowShape;
  fit: FitRect;
  imageSize: FitSize;
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdateArrow: (id: string, patch: ArrowPatch) => void;
  registerNode: (id: string, node: Konva.Node | null) => void;
}

// Skitch-style arrow rendered as a closed harpoon polygon, plus two endpoint
// drag handles (Konva.Circle) drawn when the arrow is selected in select
// mode. Dragging a handle moves only that endpoint and live-previews the
// polygon by writing directly into the Line's `points` (mirroring how
// Konva.Transformer mutates scale during a transform). The store update is
// deferred to onDragEnd so undo records exactly one entry per gesture.
export function ArrowShapeNode(props: ArrowShapeNodeProps) {
  const { shape, fit, imageSize, isSelectMode, isSelected, onSelect, onUpdateArrow, registerNode } =
    props;
  const lineRef = useRef<Konva.Line | null>(null);
  const fromHandleRef = useRef<Konva.Circle | null>(null);
  const toHandleRef = useRef<Konva.Circle | null>(null);
  const { scaleX: imgScaleX, scaleY: imgScaleY } = imageToScreenScale(fit, imageSize);

  useEffect(() => {
    registerNode(shape.id, lineRef.current);
    return () => registerNode(shape.id, null);
  }, [shape.id, registerNode]);

  const fromScreen = imageToScreen({ x: shape.fromX, y: shape.fromY }, fit, imageSize);
  const toScreen = imageToScreen({ x: shape.toX, y: shape.toY }, fit, imageSize);
  const arrowScale = Math.min(imgScaleX, imgScaleY);
  const polygonOpts = {
    tailHalfWidth: ARROW_TAIL_HALF_WIDTH * arrowScale,
    neckHalfWidth: ARROW_NECK_HALF_WIDTH * arrowScale,
    headHalfWidth: ARROW_HEAD_HALF_WIDTH * arrowScale,
    neckLength: ARROW_NECK_LENGTH * arrowScale,
    headLength: ARROW_HEAD_LENGTH * arrowScale,
  };
  const polygon = computeArrowPolygon(fromScreen, toScreen, polygonOpts);

  const handleSelect = () => onSelect(shape.id);

  const handleEndpointDragMove = (event: KonvaEventObject<DragEvent>, which: ArrowEndpoint) => {
    event.cancelBubble = true;
    const line = lineRef.current;
    if (!line) {
      return;
    }
    const node = event.target;
    const moved = { x: node.x(), y: node.y() };
    const fixed = which === "from" ? toScreen : fromScreen;
    line.points(previewArrowPolygon(which, moved, fixed, polygonOpts));
    line.getLayer()?.batchDraw();
  };

  const handleEndpointDragEnd = (event: KonvaEventObject<DragEvent>, which: ArrowEndpoint) => {
    event.cancelBubble = true;
    const node = event.target;
    const moved = { x: node.x(), y: node.y() };
    if (which === "from") {
      const patch = commitArrowEndpoint("from", moved, fit, imageSize);
      onUpdateArrow(shape.id, patch);
    } else {
      const patch = commitArrowEndpoint("to", moved, fit, imageSize);
      onUpdateArrow(shape.id, patch);
    }
  };

  return (
    <>
      <Line
        ref={(node) => {
          lineRef.current = node;
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
        onDragMove={(event: KonvaEventObject<DragEvent>) => {
          // The Line's points are absolute screen coords; Konva drags by
          // mutating the node's x/y as a translation offset. Mirror that
          // offset onto the endpoint handles so they follow the body during
          // the gesture (instead of snapping in only on dragEnd). The store
          // is still untouched here — onDragEnd commits exactly once.
          const node = event.target;
          const dx = node.x();
          const dy = node.y();
          fromHandleRef.current?.position({ x: fromScreen.x + dx, y: fromScreen.y + dy });
          toHandleRef.current?.position({ x: toScreen.x + dx, y: toScreen.y + dy });
          node.getLayer()?.batchDraw();
        }}
        onDragEnd={(event: KonvaEventObject<DragEvent>) => {
          const node = event.target;
          const dx = node.x();
          const dy = node.y();
          node.x(0);
          node.y(0);
          const newFrom = screenToImage(
            { x: fromScreen.x + dx, y: fromScreen.y + dy },
            fit,
            imageSize,
          );
          const newTo = screenToImage(
            { x: toScreen.x + dx, y: toScreen.y + dy },
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
      {isSelectMode && isSelected
        ? (
          <>
            <Circle
              ref={(node) => {
                fromHandleRef.current = node;
              }}
              x={fromScreen.x}
              y={fromScreen.y}
              radius={ARROW_HANDLE_RADIUS}
              fill={ARROW_HANDLE_FILL}
              stroke={ARROW_HANDLE_STROKE}
              strokeWidth={ARROW_HANDLE_STROKE_WIDTH}
              shadowColor="rgba(0,0,0,0.45)"
              shadowBlur={ARROW_HANDLE_SHADOW_BLUR}
              draggable
              listening
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragStart={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => handleEndpointDragMove(event, "from")}
              onDragEnd={(event) => handleEndpointDragEnd(event, "from")}
            />
            <Circle
              ref={(node) => {
                toHandleRef.current = node;
              }}
              x={toScreen.x}
              y={toScreen.y}
              radius={ARROW_HANDLE_RADIUS}
              fill={ARROW_HANDLE_FILL}
              stroke={ARROW_HANDLE_STROKE}
              strokeWidth={ARROW_HANDLE_STROKE_WIDTH}
              shadowColor="rgba(0,0,0,0.45)"
              shadowBlur={ARROW_HANDLE_SHADOW_BLUR}
              draggable
              listening
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragStart={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => handleEndpointDragMove(event, "to")}
              onDragEnd={(event) => handleEndpointDragEnd(event, "to")}
            />
          </>
        )
        : null}
    </>
  );
}
