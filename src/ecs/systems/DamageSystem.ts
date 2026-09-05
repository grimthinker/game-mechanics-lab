import { World } from '../World';

export class DamageSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('health', 'healthStats');

    for (const [id, { health, healthStats }] of entities) {
      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer--;
      }

      if (healthStats.hp.current <= 0 && health.isAlive) {
        health.isAlive = false;
        healthStats.hp.current = 0;
        
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