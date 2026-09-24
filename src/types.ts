import { EntityConfig } from './ecs/types';
import { BodyStructureType } from './ecs/templates';

export type Radians = number;
export type Degrees = number;

export interface Point {
  x: number;
  y: number;
}

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

export type TerrainToolType = 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint';
export type TerrainTextureChannel = 0 | 1 | 2 | 3; // R: Grass, G: Rock, B: Dirt, A: Sand

export interface TerrainBrushState {
  active: boolean;
  tool: TerrainToolType;
  texture: TerrainTextureChannel;
  radius: number;
  strength: number;
}
