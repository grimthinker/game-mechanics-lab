import { WeaponConfig } from '../types';
import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';

export class AttackSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith('equip', 'activeAttacks', 'health', 'input', 'healthStats');

    for (const [id, { equip, activeAttacks, health, input, healthStats }] of entities) {
      if (!health.isAlive || healthStats.hp.current <= 0) continue;

      if (input.wantsAttack && !input.isRunning) {
        const weaponSlot = equip.slots.find((s) => s.type === 'weapon' && s.itemId !== null);
        let weaponConfig: WeaponConfig | undefined = undefined;
        if (weaponSlot && weaponSlot.itemId) {
           const wItem = world.getComponent(weaponSlot.itemId, 'item');
           if (wItem && wItem.type === 'weapon') {
               weaponConfig = wItem.config as WeaponConfig;
           }
        }

        if (weaponConfig && !activeAttacks.attacks.some((a) => a.weapon === weaponConfig)) {
          activeAttacks.attacks.push({
            weapon: weaponConfig,
            phase: 'prep',
            timer: weaponConfig.prepTime,
            totalDuration: weaponConfig.prepTime,
          });
        }
        input.wantsAttack = false;
      }

      for (let i = activeAttacks.attacks.length - 1; i >= 0; i--) {
        const atk = activeAttacks.attacks[i];
        atk.timer -= dt;

        if (atk.timer <= 0) {
          if (atk.phase === 'prep') {
            const castTime = atk.weapon.castTime ?? 0;
            if (castTime > 0) {
              atk.phase = 'cast';
              atk.timer = castTime;
              atk.totalDuration = castTime;
            } else {
              this.executeHit(id, atk.weapon, world, physics);
              health.hitFlashTimer = 6;
              atk.phase = 'recovery';
              atk.timer = atk.weapon.recoveryTime;
              atk.totalDuration = atk.weapon.recoveryTime;
            }
          } else if (atk.phase === 'cast') {
            this.executeHit(id, atk.weapon, world, physics);
            health.hitFlashTimer = 6;
            atk.phase = 'recovery';
            atk.timer = atk.weapon.recoveryTime;
            atk.totalDuration = atk.weapon.recoveryTime;
          } else {
            activeAttacks.attacks.splice(i, 1);
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
      const targetStats = world.getComponent(targetId, 'healthStats');
      if (!targetHealth || !targetHealth.isAlive || !targetStats) continue;

      const mult =
        weapon.minMultiplier +
        Math.random() * (weapon.maxMultiplier - weapon.minMultiplier);
      let damage = weapon.baseDamage * mult;
      const isCrit = Math.random() < weapon.critChance;
      if (isCrit) damage *= weapon.critMultiplier;

      const dmgValue = Math.round(damage);
      targetStats.hp.current = Math.max(0, targetStats.hp.current - dmgValue);
      targetHealth.hitFlashTimer = 6;
    }
  }
}