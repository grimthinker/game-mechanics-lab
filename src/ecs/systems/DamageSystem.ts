import { World } from '../World';

export class DamageSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('health', 'input', 'activeAttacks', 'meta', 'stats');

    for (const [id, { health, input, activeAttacks, meta, stats }] of entities) {
      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer--;
      }

      if (stats.hp.current <= 0 && health.isAlive) {
        health.isAlive = false;
        stats.hp.current = 0;
        input.isMovingForward = false;
        input.turnDirection = 0;
        input.isRunning = false;
        input.isCrouching = false;
        input.wantsAttack = false;
        activeAttacks.attacks = [];
        meta.state = 'dead';
      }
    }
  }
}