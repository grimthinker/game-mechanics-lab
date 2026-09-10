import { EntityConfig } from './ecs/types';
import { BALANCE_CONFIG } from '../config/balanceConfig';

export function createDefaultCreatureConfig(behavior: string = 'PlayerTree'): EntityConfig {
  const cfg = BALANCE_CONFIG.creature;
  return {
    physics: {
      radius: cfg.radius,
      weight: cfg.weight,
      isSolid: true,
    },
    health: {
      hp: cfg.hp,
      maxHp: cfg.maxHp,
    },
    armorStats: {
      defense: 0,
      flatReduction: 0,
    },
    movement: {
      maxSpeed: cfg.maxSpeed,
      maxTurnSpeed: cfg.maxTurnSpeed,
      runSpeedMultiplier: cfg.runSpeedMultiplier,
      crouchSpeedMultiplier: cfg.crouchSpeedMultiplier,
      walkSpeedMultiplier: cfg.walkSpeedMultiplier,
      runTurnMultiplier: cfg.runTurnMultiplier,
      crouchTurnMultiplier: cfg.crouchTurnMultiplier,
      strafeSpeedMultiplier: cfg.strafeSpeedMultiplier,
      backwardSpeedMultiplier: cfg.backwardSpeedMultiplier,
      strafeTurnMultiplier: cfg.strafeTurnMultiplier,
      backwardTurnMultiplier: cfg.backwardTurnMultiplier,
      pickupSpeedMultiplier: cfg.pickupSpeedMultiplier,
      pickupTurnMultiplier: cfg.pickupTurnMultiplier,
    },
    stealth: {
      stealthPower: cfg.stealthPower,
      runStealthMultiplier: cfg.runStealthMultiplier,
      crouchStealthMultiplier: cfg.crouchStealthMultiplier,
      walkStealthMultiplier: cfg.walkStealthMultiplier,
      turnInPlaceStealthMultiplier: cfg.turnInPlaceStealthMultiplier,
      immobileStealthMultiplier: cfg.immobileStealthMultiplier,
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
      actionMode: 'idle',
      entityType: 'creature',
    },
  };
}
