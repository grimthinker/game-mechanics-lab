import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { WeaponConfig } from '../../types';

export class AttackSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith('weaponInventory', 'health', 'input');

    for (const [id, { weaponInventory, health, input }] of entities) {
      if (!health.isAlive || health.hp <= 0) continue;

      if (input.wantsAttack && !input.isRunning) {
        const freeWeapon = weaponInventory.weapons.find(
          (w) => !weaponInventory.activeAttacks.some((a) => a.weapon === w)
        );
        if (freeWeapon) {
          weaponInventory.activeAttacks.push({
            weapon: freeWeapon,
            phase: 'prep',
            timer: freeWeapon.prepTime,
            totalDuration: freeWeapon.prepTime,
          });
        }
        input.wantsAttack = false;
      }

      for (let i = weaponInventory.activeAttacks.length - 1; i >= 0; i--) {
        const atk = weaponInventory.activeAttacks[i];
        atk.timer -= dt;

        if (atk.timer <= 0) {
          if (atk.phase === 'prep') {
            this.executeHit(id, atk.weapon, world, physics);
            health.hitFlashTimer = 6;
            atk.phase = 'recovery';
            atk.timer = atk.weapon.recoveryTime;
            atk.totalDuration = atk.weapon.recoveryTime;
          } else {
            weaponInventory.activeAttacks.splice(i, 1);
          }
        }
      }
    }
  }

  private executeHit(
    attackerId: string,
    weapon: WeaponConfig,
    world: World,
    physics: PhysicsSystem
  ): void {
    const targetIds = physics.checkWeaponHits(attackerId, weapon, world);

    for (const targetId of targetIds) {
      const targetHealth = world.getComponent(targetId, 'health');
      if (!targetHealth || !targetHealth.isAlive) continue;

      const mult =
        weapon.minMultiplier +
        Math.random() * (weapon.maxMultiplier - weapon.minMultiplier);
      let damage = weapon.baseDamage * mult;
      const isCrit = Math.random() < weapon.critChance;
      if (isCrit) damage *= weapon.critMultiplier;

      targetHealth.hp = Math.max(0, targetHealth.hp - Math.round(damage));
      targetHealth.hitFlashTimer = 6;
    }
  }
}