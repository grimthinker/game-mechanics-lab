import { World } from '../World';
import { ModifierType } from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';

export class StealthSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('stealthStats', 'health', 'meta');

    for (const [_id, { stealthStats, health, meta }] of entities) {
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
      if (meta.stance === 'crouching') {
        addModifier(stealthStats.stealthPower, {
          id: 'stance_crouch_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.crouchStealthMultiplier,
        });
      } else {
        removeModifier(stealthStats.stealthPower, 'stance_crouch_stealth');
      }

      // 2. Модификатор вида движения (Movement Mode), актуализированный в MovementSystem
      const movementMode = meta.movementMode ?? 'immobile';

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
      // Режимы 'jogging' и 'attacking' не имеют модификаторов и сохраняют базовый стелс
    }
  }
}
