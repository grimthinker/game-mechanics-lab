import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { Camera } from '../Camera';
import { EntityId } from '../ecs/types';
import { Point } from '../types';

import { GizmoRenderData } from '../gizmos/types';

export interface EditorRenderData {
  selectedId: EntityId | null;
  selectedIds: Set<EntityId>;
  hoveredId: EntityId | null;
  marqueeBox?: { start: Point; current: Point } | null;
  gizmo?: GizmoRenderData | null;
}

export interface RenderContext {
  camera: Camera;
  world: World;
  physics: PhysicsSystem;
  gameMode: string;
  editorData: EditorRenderData;
  showUIOverlays: boolean;
}

export interface IRenderer {
  init?(): void;
  resize(width: number, height: number): void;
  render(context: RenderContext): void;
  destroy?(): void;
  getCanvas(): HTMLCanvasElement;
  screenToWorld(clientX: number, clientY: number, camera2D: Camera): Point;
  pickEntity?(clientX: number, clientY: number): EntityId | null;
}
