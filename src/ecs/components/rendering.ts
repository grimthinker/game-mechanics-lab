import { Point } from '../../types';
import { EntityArchetype } from './base';

export interface TagComponent {
  archetype: EntityArchetype;
  subType?: string;
}

export interface RenderCirclePrimitive {
  kind: 'circle';
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderRectPrimitive {
  kind: 'rect';
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderLinePrimitive {
  kind: 'line';
  from: Point;
  to: Point;
  stroke: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderArcPrimitive {
  kind: 'arc';
  radius: number;
  startAngle: number;
  endAngle: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  closed?: boolean;
}

export interface RenderPolygonPrimitive {
  kind: 'polygon';
  points: Point[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderTextPrimitive {
  kind: 'text';
  text: string;
  offset?: Point;
  font?: string;
  fill: string;
  ignoreRotation?: boolean;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export type RenderPrimitive =
  | RenderCirclePrimitive
  | RenderRectPrimitive
  | RenderLinePrimitive
  | RenderArcPrimitive
  | RenderPolygonPrimitive
  | RenderTextPrimitive;

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
  zIndex: number;
  primitives: RenderPrimitive[];
  isVisible: boolean;
  syncWithTransform?: boolean;
}

export type ZoneEffectType = 'damage' | 'heal' | 'repel' | 'attract' | 'time_dilation';

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
