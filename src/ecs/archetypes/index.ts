import { EntityArchetype, EntityConfig } from '../types';
import { EntityAssembler } from './types';
import { assembleCreature } from './CreatureArchetype';
import { assembleItem } from './ItemArchetype';
import { assembleMarker } from './MarkerArchetype';
import { assembleZone } from './ZoneArchetype';
import { assembleObstacle } from './ObstacleArchetype';
import { assembleBodyPart } from './BodyPartArchetype';
import { assembleTerrain } from './TerrainArchetype';

export * from './types';
export * from './CreatureArchetype';
export * from './ItemArchetype';
export * from './MarkerArchetype';
export * from './ZoneArchetype';
export * from './ObstacleArchetype';
export * from './BodyPartArchetype';
export * from './TerrainArchetype';

export const ARCHETYPE_ASSEMBLERS: Record<EntityArchetype, EntityAssembler> = {
  creature: assembleCreature,
  item: assembleItem,
  marker: assembleMarker,
  zone: assembleZone,
  obstacle: assembleObstacle,
  projectile: assembleCreature,
  particles: assembleMarker,
  bodyPart: assembleBodyPart,
  terrain: assembleTerrain,
};

export function detectArchetype(config: EntityConfig): EntityArchetype {
  if (config.tag?.archetype) return config.tag.archetype;
  if (config.terrain) return 'terrain';
  if (config.areaEffector || (config as any).zoneTrigger) return 'zone';
  if (config.item) return 'item';
  if (config.gizmo) return 'marker';
  if (config.meta?.entityType === 'obstacle' || (config.physics && config.physics.points)) {
    return 'obstacle';
  }
  return 'creature';
}
