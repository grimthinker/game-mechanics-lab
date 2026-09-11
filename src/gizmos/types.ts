import { Point } from '../types';
import { Radians } from '../utils';

export type GizmoTool = 'select' | 'translate' | 'rotate';
export type GizmoHandle = 'center' | 'x' | 'y' | 'rotate';

export interface GizmoInitialEntityData {
  pos: Point;
  angle: Radians;
}

export interface GizmoDragState {
  tool: GizmoTool;
  handle: GizmoHandle;
  startPoint: Point;
  currentPoint: Point;
  anchorPos: Point;
  startAngle: number;
  currentAngle: number;
  initialAnchorAngle: number;
  appliedDeltaAngle: number;
  initialEntities: Map<string, GizmoInitialEntityData>;
}

export interface GizmoRenderData {
  tool: GizmoTool;
  position: Point;
  angle: number;
  initialAngle?: number;
  hoveredHandle: GizmoHandle | null;
  activeHandle: GizmoHandle | null;
  isDragging: boolean;
  dragDelta?: Point;
  dragDeltaAngle?: number;
}
