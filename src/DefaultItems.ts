import { ItemData } from './ecs/types';

export function createDefaultArmorItem(): ItemData {
  return {
    id: `armor_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    name: 'Стандартный бронежилет',
    type: 'armor',
    maxStack: 1,
    config: {
      id: `armor_cfg_${Math.random().toString(36).substring(2, 5)}`,
      name: 'Стандартный бронежилет',
      weight: 3,
      radius: 16,
      isSolid: true,
      defense: 15,
      flat_reduction: 3,
    },
  };
}

export function createDefaultBagItem(): ItemData {
  return {
    id: `bag_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    name: 'Походный рюкзак',
    type: 'bag',
    maxStack: 1,
    config: {
      id: `bag_cfg_${Math.random().toString(36).substring(2, 5)}`,
      name: 'Походный рюкзак',
      weight: 1,
      radius: 16,
      isSolid: true,
      size: { width: 6, height: 4 },
    },
  };
}