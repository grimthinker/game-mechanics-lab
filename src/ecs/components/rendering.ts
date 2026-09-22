import { EntityArchetype } from './base';

export interface TagComponent {
  archetype: EntityArchetype;
  subType?: string;
}

export const RENDER_Z_INDEX = {
  ZONES: 0,
  OBSTACLES: 5,
  ITEMS: 10,
  CORPSES: 20,
  PROJECTILES: 30,
  CREATURES: 40,
  ATTACKS: 50,
  PARTICLES: 60,
  GIZMOS: 90,
  UI: 100,
} as const;

export interface RenderableComponent {
  zIndex?: number;
  isVisible: boolean;
  syncWithTransform?: boolean;
}

export type ZoneEffectType =
  'damage' | 'heal' | 'repel' | 'attract' | 'time_dilation' | 'joint_damage';

export interface AreaEffectorComponent {
  effect: ZoneEffectType;
  valuePerSec: number;
  radius: number;
  ignoreParent?: boolean;
  destroyOnParentDeath?: boolean;
  destroyOnParentRemoval?: boolean;
  distanceAttenuation?: boolean;
  centerValue?: number;
  boundaryValue?: number;
}

export interface AttachmentComponent {
  parentId: string;
  offsetX?: number;
  offsetY?: number;
}

export interface GizmoComponent {
  type: 'spawner' | 'waypoint' | 'trigger' | 'sound' | 'marker';
  color?: string;
  icon?: string;
  radius?: number;
}

export interface VisualModelComponent {
  modelId: string;
  rigType?: string;
  rigNodeName?: string;
  materialId?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface AnimatorComponent {
  rigType: string;
  currentAnimation: string;
  playbackSpeed: number;
  clipsMap: Record<string, string>;
}
