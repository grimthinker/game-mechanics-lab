import { StandardRadius } from '../src/ecs/types';
import { deg2Rad } from '../src/utils';

export const BALANCE_CONFIG = {
  creature: {
    radius: 16 as StandardRadius,
    weight: 10,
    hp: 100,
    maxHp: 100,
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
    pickupSpeedMultiplier: 0.5,
    pickupTurnMultiplier: 1.1,
    stealthPower: 10,
    runStealthMultiplier: 0.5,
    crouchStealthMultiplier: 1.5,
    walkStealthMultiplier: 1.3,
    turnInPlaceStealthMultiplier: 1.5,
    immobileStealthMultiplier: 2.0,
  },
};
