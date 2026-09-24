import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { Camera } from '../Camera';
import { EntityId } from '../ecs/types';
import { Point, Vec3 } from '../types';

import { TerrainBrushState } from '../types';
export interface EditorRenderData {
  selectedId: EntityId | null;
  selectedIds: Set<EntityId>;
  hoveredId: EntityId | null;
  marqueeBox?: { start: Point; current: Point } | null;
  showAIDebug?: boolean;
  gizmoTool?: 'select' | 'translate' | 'rotate';
  terrainBrush?: TerrainBrushState;
  cursorWorldPos?: Vec3 | null;
  throwTrajectory?: { start: Vec3; v0: Vec3 } | null;
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
  screenToWorld(clientX: number, clientY: number, camera: Camera): Vec3;
  getScreenRay?(clientX: number, clientY: number): { origin: Vec3; direction: Vec3 };
  pickEntity?(clientX: number, clientY: number): EntityId | null;
  projectToScreen?(pos: Vec3): Vec3 | null;
}
