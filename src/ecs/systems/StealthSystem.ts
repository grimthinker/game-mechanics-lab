import { World } from '../World';
import { ModifierType } from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';

export class StealthSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('stealthStats', 'input', 'health');

    for (const [_id, { stealthStats, input, health }] of entities) {
      if (!health.isAlive || health.current <= 0) {
        removeModifier(stealthStats.stealthPower, 'state_crouch_stealth');
        removeModifier(stealthStats.stealthPower, 'state_run_stealth');
        stealthStats.stealthPower.current = 0;
        continue;
      }

      if (input.isCrouching) {
        addModifier(stealthStats.stealthPower, {
          id: 'state_crouch_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.crouchStealthMultiplier,
        });
        removeModifier(stealthStats.stealthPower, 'state_run_stealth');
      } else if (input.isRunning) {
        addModifier(stealthStats.stealthPower, {
          id: 'state_run_stealth',
          type: ModifierType.PERCENT_MULT,
          value: stealthStats.runStealthMultiplier,
        });
        removeModifier(stealthStats.stealthPower, 'state_crouch_stealth');
      } else {
        removeModifier(stealthStats.stealthPower, 'state_crouch_stealth');
        removeModifier(stealthStats.stealthPower, 'state_run_stealth');
      }
    }
  }
}
