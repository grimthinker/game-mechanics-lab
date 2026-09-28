import { EntityConfig } from './ecs/types';
import { BodyStructureType } from './ecs/templates';

export type Radians = number;
export type Degrees = number;

/** 2D-координаты для экранных операций, рамки выделения и курсора в UI */
export interface Point {
  x: number;
  y: number;
}

/** 3D-вектор в мировом пространстве (X, Z — горизонтальная плоскость, Y — высота) */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BlackboardPickingState {
  entityId: string;
  key: string;
}

export interface ModularPlacementOptions {
  structureType: BodyStructureType;
  behavior: string;
  name: string;
}

export type GizmoTool = 'select' | 'translate' | 'rotate';
export type PlacementMode =
  { kind: 'entity'; config: EntityConfig } | { kind: 'modular'; options: ModularPlacementOptions };

export type TerrainToolType =
  'raise' | 'lower' | 'flatten' | 'smooth' | 'paint' | 'foliage' | 'clear_foliage';

export type TerrainTextureChannel = 0 | 1 | 2 | 3; // R: Grass, G: Rock, B: Dirt, A: Sand
export type FoliageZoneChannel = 0 | 1 | 2 | 3 | 4; // 0: Grass, 1: Wheat, 2: Reeds, 3: Dry Grass, 4: Flowers

export interface TerrainBrushState {
  active: boolean;
  tool: TerrainToolType;
  texture: TerrainTextureChannel;
  foliageZone: FoliageZoneChannel;
  radius: number;
  strength: number;
}
