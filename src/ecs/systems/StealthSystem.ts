import { World } from '../World';
import { CreatureMovementMode, ModifierType } from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';

export class StealthSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('stealthStats', 'input', 'health');

    for (const [_id, { stealthStats, input, health }] of entities) {
      if (!health.isAlive) {
        removeModifier(stealthStats.stealthPower, 'stance_crouch_stealth');
        removeModifier(stealthStats.stealthPower, 'mode_sprint_stealth');
        removeModifier(stealthStats.stealthPower, 'mode_walk_stealth');
        removeModifier(stealthStats.stealthPower, 'mode_turning_stealth');
        removeModifier(stealthStats.stealthPower, 'mode_immobile_stealth');
        addModifier(stealthStats.stealthPower, {
          id: 'state_dead_stealth',
          type: ModifierType.PERCENT_MULT,
          value: 0,
        });
        continue;
      }

      removeModifier(stealthStats.stealthPower, 'state_dead_stealth');

      // 1. Модификатор положения (Stance)
      if (input.isCrouching) {
        addModifier(stealthStats.stealthPower, {
          id: 'stance_crouch_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.crouchStealthMultiplier,
        });
      } else {
        removeModifier(stealthStats.stealthPower, 'stance_crouch_stealth');
      }

      // 2. Определение вида движения для стелса
      let movementMode: CreatureMovementMode = 'immobile';
      if (input.isMovingForward) {
        if (input.isRunning) {
          movementMode = 'sprinting';
        } else if (input.isSlowWalking) {
          movementMode = 'walking';
        } else {
          movementMode = 'jogging';
        }
      } else if (input.turnDirection !== 0) {
        movementMode = 'turning';
      } else {
        movementMode = 'immobile';
      }

      removeModifier(stealthStats.stealthPower, 'mode_sprint_stealth');
      removeModifier(stealthStats.stealthPower, 'mode_walk_stealth');
      removeModifier(stealthStats.stealthPower, 'mode_turning_stealth');
      removeModifier(stealthStats.stealthPower, 'mode_immobile_stealth');

      if (movementMode === 'sprinting') {
        addModifier(stealthStats.stealthPower, {
          id: 'mode_sprint_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.runStealthMultiplier,
        });
      } else if (movementMode === 'walking') {
        addModifier(stealthStats.stealthPower, {
          id: 'mode_walk_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.walkStealthMultiplier,
        });
      } else if (movementMode === 'turning') {
        addModifier(stealthStats.stealthPower, {
          id: 'mode_turning_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.turnInPlaceStealthMultiplier,
        });
      } else if (movementMode === 'immobile') {
        addModifier(stealthStats.stealthPower, {
          id: 'mode_immobile_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.immobileStealthMultiplier,
        });
      }
    }
  }
}
