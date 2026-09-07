import { World } from '../World';
import { Radians } from '../../utils';
import { removeModifier } from '../stats/StatEvaluator';

export class DamageSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('health');

    for (const [id, { health }] of entities) {
      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer--;
      }

      if (health.healFlashTimer && health.healFlashTimer > 0) {
        health.healFlashTimer--;
      }

      if (health.current <= 0 && health.isAlive) {
        health.isAlive = false;
        health.current = 0;

        const input = world.getComponent(id, 'input');
        if (input) {
          input.isMovingForward = false;
          input.turnDirection = 0;
          input.isRunning = false;
          input.isCrouching = false;
          input.wantsAttack = false;
        }

        const velocity = world.getComponent(id, 'velocity');
        if (velocity) {
          velocity.currentSpeed = 0;
          velocity.currentTurnSpeed = 0 as Radians;
        }

        const movementStats = world.getComponent(id, 'movementStats');
        if (movementStats) {
          removeModifier(movementStats.maxSpeed, 'state_run_speed');
          removeModifier(movementStats.maxSpeed, 'state_crouch_speed');
          removeModifier(movementStats.maxSpeed, 'attack_slow_move');
          removeModifier(movementStats.maxTurnSpeed, 'state_run_turn');
          removeModifier(movementStats.maxTurnSpeed, 'state_crouch_turn');
          removeModifier(movementStats.maxTurnSpeed, 'attack_slow_turn');
        }

        const activeAttacks = world.getComponent(id, 'activeAttacks');
        if (activeAttacks) {
          activeAttacks.attacks = [];
        }

        const meta = world.getComponent(id, 'meta');
        if (meta) {
          meta.state = 'dead';
        }
      }
    }
  }
}
