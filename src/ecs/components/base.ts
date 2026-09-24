export type EntityId = string;

export type EntityArchetype =
  | 'creature'
  | 'item'
  | 'projectile'
  | 'zone'
  | 'marker'
  | 'particles'
  | 'obstacle'
  | 'bodyPart'
  | 'terrain';

export const enum CollisionCategory {
  NONE = 0,
  OBSTACLE = 1 << 0, // 1
  CREATURE = 1 << 1, // 2
  ITEM = 1 << 2, // 4
  PROJECTILE = 1 << 3, // 8
  TRIGGER_ZONE = 1 << 4, // 16
  PARTICLE = 1 << 5, // 32
}

export const COLLISION_MASK_PHYSICAL =
  CollisionCategory.OBSTACLE | CollisionCategory.CREATURE | CollisionCategory.ITEM;

export const COLLISION_MASK_ALL =
  CollisionCategory.OBSTACLE |
  CollisionCategory.CREATURE |
  CollisionCategory.ITEM |
  CollisionCategory.PROJECTILE |
  CollisionCategory.TRIGGER_ZONE |
  CollisionCategory.PARTICLE;

export const COLLISION_MASK_NONE = 0;
