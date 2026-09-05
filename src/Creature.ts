import { EntityConfig, StandardRadius } from './ecs/types';

export function createDefaultCreatureConfig(behavior: string = 'PlayerTree'): EntityConfig {
  return {
    physics: {
      radius: 16 as StandardRadius,
      weight: 10,
      isSolid: true,
    },
    health: {
      hp: 100,
      maxHp: 100,
    },
    movement: {
      maxSpeed: 150,
      maxTurnSpeed: 270,
      runSpeedMultiplier: 1.5,
      crouchSpeedMultiplier: 0.5,
      runTurnMultiplier: 0.8,
      crouchTurnMultiplier: 1.2,
    },
    stealth: {
      stealthPower: 10,
      runStealthMultiplier: 0.5,
      crouchStealthMultiplier: 1.5,
    },
    ai: {
      behavior,
    },
    equip: [
      { type: 'armor', itemId: null },
      { type: 'bag', itemId: null },
      { type: 'weapon', itemId: null },
    ],
    meta: {
      entityType: 'creature',
    },
  };
}