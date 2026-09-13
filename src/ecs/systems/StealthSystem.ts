import { World } from '../World';
import { ModifierType } from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';

export class StealthSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('stealthStats', 'health', 'meta');

    for (const [_id, { stealthStats, health, meta }] of entities) {
      if (!health.isAlive) {
        removeModifier(stealthStats.stealthPower, 'stance_stealth');
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

      // 1. Модификатор положения (Stance) с усреднением для переходных стоек
      let stanceStealthMult = 1.0;
      const crouchSt = stealthStats.crouchStealthMultiplier;
      const proneSt = stealthStats.proneStealthMultiplier;

      switch (meta.stance) {
        case 'crouching':
          stanceStealthMult = crouchSt;
          break;
        case 'prone':
          stanceStealthMult = proneSt;
          break;
        case 'stand_to_crouch':
        case 'crouch_to_stand':
          stanceStealthMult = (1.0 + crouchSt) / 2;
          break;
        case 'stand_to_prone':
        case 'prone_to_stand':
          stanceStealthMult = (1.0 + proneSt) / 2;
          break;
        case 'crouch_to_prone':
        case 'prone_to_crouch':
          stanceStealthMult = (crouchSt + proneSt) / 2;
          break;
        default:
          stanceStealthMult = 1.0;
          break;
      }

      if (stanceStealthMult !== 1.0) {
        addModifier(stealthStats.stealthPower, {
          id: 'stance_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stanceStealthMult,
        });
      } else {
        removeModifier(stealthStats.stealthPower, 'stance_stealth');
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
