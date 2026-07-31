import { World } from '../World';

export class DamageSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('health', 'input', 'weaponInventory', 'meta');

    for (const [id, { health, input, weaponInventory, meta }] of entities) {
      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer--;
      }

      if (health.hp <= 0 && health.isAlive) {
        health.isAlive = false;
        health.hp = 0;
        input.isMovingForward = false;
        input.turningDirection = 0;
        input.isRunning = false;
        input.isCrouching = false;
        input.wantsAttack = false;
        weaponInventory.activeAttacks = [];
        meta.state = 'dead';
      }
    }
  }
}