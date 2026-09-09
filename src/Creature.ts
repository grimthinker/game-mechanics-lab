import { EntityConfig, StandardRadius } from './ecs/types';
import { deg2Rad } from './utils';

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
      maxTurnSpeed: deg2Rad(270),
      runSpeedMultiplier: 1.5,
      crouchSpeedMultiplier: 0.5,
      walkSpeedMultiplier: 0.5,
      runTurnMultiplier: 0.8,
      crouchTurnMultiplier: 0.8,
      strafeSpeedMultiplier: 0.8,
      backwardSpeedMultiplier: 0.6,
      strafeTurnMultiplier: 0.8,
      backwardTurnMultiplier: 0.6,
    },
    stealth: {
      stealthPower: 10,
      runStealthMultiplier: 0.5,
      crouchStealthMultiplier: 1.5,
      walkStealthMultiplier: 1.3,
      turnInPlaceStealthMultiplier: 1.5,
      immobileStealthMultiplier: 2.0,
    },
    ai: {
      behavior,
    },
    equip: {
      interactionSlots: [
        { id: 'hand_left', interactDist: 15, strength: 50, itemId: null },
        { id: 'hand_right', interactDist: 15, strength: 50, itemId: null },
      ],
      equipmentAreas: [
        { id: 'head', name: 'Голова', type: 'head', space: 10, itemIds: [] },
        { id: 'neck', name: 'Шея', type: 'neck', space: 10, itemIds: [] },
        { id: 'torso', name: 'Туловище', type: 'torso', space: 40, itemIds: [] },
        { id: 'hands_1', name: 'Рука (кольца)', type: 'hands', space: 10, itemIds: [] },
        { id: 'hands_2', name: 'Рука (браслеты)', type: 'hands', space: 10, itemIds: [] },
        { id: 'legs', name: 'Ноги', type: 'legs', space: 20, itemIds: [] },
        { id: 'feet_1', name: 'Ступня левая', type: 'feet', space: 10, itemIds: [] },
        { id: 'feet_2', name: 'Ступня правая', type: 'feet', space: 10, itemIds: [] },
      ],
    },
    meta: {
      name: 'Существо',
      stance: 'standing',
      movementMode: 'immobile',
      directionMode: 'immobile',
      entityType: 'creature',
    },
  };
}
