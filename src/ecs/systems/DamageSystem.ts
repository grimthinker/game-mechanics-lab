import { World } from '../World';

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
