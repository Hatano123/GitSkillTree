import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

type Point = { x: number; y: number };
type CircularEdgeData = {
  center: Point;
  sourcePoint: Point;
  targetPoint: Point;
};

export default function CircularEdge({ id, data, style, markerEnd }: EdgeProps) {
  const edgeData = data as CircularEdgeData | undefined;
  if (!edgeData) return null;

  const { center, sourcePoint, targetPoint } = edgeData;
  const sourceVector = {
    x: sourcePoint.x - center.x,
    y: sourcePoint.y - center.y,
  };
  const targetVector = {
    x: targetPoint.x - center.x,
    y: targetPoint.y - center.y,
  };
  const sourceRadius = Math.hypot(sourceVector.x, sourceVector.y);
  const targetRadius = Math.hypot(targetVector.x, targetVector.y);
  const dot = sourceVector.x * targetVector.x + sourceVector.y * targetVector.y;
  const cosine = Math.max(-1, Math.min(1, dot / (sourceRadius * targetRadius)));
  const halfAngle = Math.acos(cosine) / 2;
  const middleVector = {
    x: sourceVector.x + targetVector.x,
    y: sourceVector.y + targetVector.y,
  };
  const middleLength = Math.hypot(middleVector.x, middleVector.y) || 1;
  const controlRadius = ((sourceRadius + targetRadius) / 2) / Math.max(Math.cos(halfAngle), 0.2);
  const control = {
    x: center.x + (middleVector.x / middleLength) * controlRadius,
    y: center.y + (middleVector.y / middleLength) * controlRadius,
  };
  const path = `M ${sourcePoint.x} ${sourcePoint.y} Q ${control.x} ${control.y} ${targetPoint.x} ${targetPoint.y}`;

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
