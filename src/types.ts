import { CreatureState, ItemData, StandardRadius, InventoryComponent, EntityConfig, WeaponStatsComponent, ArmorStatsComponent, HitZoneConfig  } from './ecs/types';

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}


export interface EntityStats {
  id: string;
  name?: string;
  behavior: string;
  radius: number;
  weight: number;
  currentSpeed: number;
  currentTurnSpeed: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  hp: number;
  maxHp: number;
  state: CreatureState;
  equipSlots: {
    type: string;
    itemId: string | null;
    item: ItemData | null;
    weaponStats?: WeaponStatsComponent | null;
    armorStats?: ArmorStatsComponent | null;
    inventory?: InventoryComponent | null;
  }[];
  itemData?: ItemData;
  weaponStats?: WeaponStatsComponent;
  weaponZone?: HitZoneConfig;
  armorStats?: ArmorStatsComponent;
  inventory?: InventoryComponent;
}

export type PlacementMode = { kind: 'entity'; config: EntityConfig };