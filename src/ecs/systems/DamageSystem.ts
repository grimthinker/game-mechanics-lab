import { World } from '../World';
import { killEntity } from '../utils/health';

export class DamageSystem {
  public update(dt: number, world: World): void {
    const entities = world.getEntitiesWith('health');

    for (const [id, { health }] of entities) {
      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer -= dt;
        if (health.hitFlashTimer < 0) health.hitFlashTimer = 0;
      }

      if (health.healFlashTimer && health.healFlashTimer > 0) {
        health.healFlashTimer -= dt;
        if (health.healFlashTimer < 0) health.healFlashTimer = 0;
      }

      // Страховочная синхронизация на случай внешних модификаций
      if (health.current <= 0 && health.isAlive) {
        killEntity(world, id);
      }
    }
  }
}
