import { CreatureConfig, CreatureType, StandardRadius } from './ecs/types';

export function createDefaultCreatureConfig(type: CreatureType): CreatureConfig {
  return {
    type,
    radius: 16 as StandardRadius,
    weight: 10,
    isSolid: true,
    maxSpeed: 150,
    maxTurnSpeed: 270,
    hp: 100,
    maxHp: 100,
    runSpeedMultiplier: 1.5,
    crouchSpeedMultiplier: 0.5,
    crouchStealthMultiplier: 1.5,
    runTurnMultiplier: 0.8,
    crouchTurnMultiplier: 1.2,
  };
}