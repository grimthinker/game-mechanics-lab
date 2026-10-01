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
  | { kind: 'entity'; config: EntityConfig }
  | { kind: 'modular'; options: ModularPlacementOptions }
  | { kind: 'prefab'; prefabId: string; name?: string };

export type TerrainToolType =
  'raise' | 'lower' | 'flatten' | 'smooth' | 'hills' | 'paint' | 'foliage' | 'clear_foliage';

export type TerrainTextureChannel = 0 | 1 | 2 | 3 | 'custom'; // R: Grass, G: Rock, B: Dirt, A: Sand
export type FoliageZoneChannel = 0 | 1 | 2 | 3 | 4; // 0: Grass, 1: Wheat, 2: Reeds, 3: Dry Grass, 4: Flowers

export type BrushShape = 'circle' | 'square';

export interface TerrainBrushState {
  active: boolean;
  tool: TerrainToolType;
  texture: TerrainTextureChannel;
  customTextureMix: [number, number, number, number];
  foliageZone: FoliageZoneChannel;
  shape: BrushShape;
  rotation: number; // В градусах (0-90)
  radius: number;
  strength: number;
  hillSize: number;
}

export interface PropBrushItem {
  propId: string;
  weight: number;
  scaleMin: Vec3;
  scaleMax: Vec3;
  rotMin: Vec3; // В градусах
  rotMax: Vec3; // В градусах
  offsetY?: number; // Смещение по высоте в метрах (заглубление в грунт)
}

export interface PropBrushPreset {
  id: string;
  name: string;
  items: PropBrushItem[];
}

export interface PropBrushState {
  active: boolean;
  mode: 'paint' | 'erase';
  shape: BrushShape;
  rotation: number; // В градусах (0-90)
  radius: number;
  density: number; // Вероятность спавна за тик (0.1 - 1.0)
  minDistance: number; // Минимальная дистанция между объектами
  activePresetId: string | null;
}
