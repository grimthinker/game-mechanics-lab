import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { applyDamage } from '../utils/health';

export class AttackSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith('equip', 'activeAttacks', 'health', 'input');

    for (const [id, { equip, activeAttacks, health, input }] of entities) {
      if (!health.isAlive) continue;

      if (input.wantsAttack && !input.isRunning) {
        const busySlots = new Set(activeAttacks.attacks.map((a) => a.slotIndex));
        let chosenSlotIndex = -1;

        if (input.attackSlotIndex !== undefined) {
          const slot = equip.interactionSlots[input.attackSlotIndex];
          if (slot && slot.itemId !== null && !busySlots.has(input.attackSlotIndex)) {
            const item = world.getComponent(slot.itemId, 'item');
            if (item?.type === 'weapon') {
              chosenSlotIndex = input.attackSlotIndex;
            }
          }
        } else {
          chosenSlotIndex = equip.interactionSlots.findIndex((s, idx) => {
            if (s.itemId === null || busySlots.has(idx)) return false;
            const item = world.getComponent(s.itemId, 'item');
            return item?.type === 'weapon';
          });
        }

        if (chosenSlotIndex !== -1) {
          const weaponSlot = equip.interactionSlots[chosenSlotIndex];
          const weaponId = weaponSlot.itemId!;
          const wStats = world.getComponent(weaponId, 'weaponStats');

          if (wStats) {
            const prepTime = wStats.prepTime.current;
            activeAttacks.attacks.push({
              weaponId,
              slotIndex: chosenSlotIndex,
              phase: 'prep',
              timer: prepTime,
              totalDuration: prepTime,
            });
          }
        }

        input.wantsAttack = false;
        input.attackSlotIndex = undefined;
      }

      for (let i = activeAttacks.attacks.length - 1; i >= 0; i--) {
        const atk = activeAttacks.attacks[i];

        const slot = equip.interactionSlots[atk.slotIndex];
        const isStillEquipped = slot && slot.itemId === atk.weaponId;
        const wStats = isStillEquipped
          ? world.getComponent(atk.weaponId, 'weaponStats')
          : undefined;

        if (!isStillEquipped || !wStats) {
          activeAttacks.attacks.splice(i, 1);
          continue;
        }

        const castTime = wStats.castTime.current;
        const recoveryTime = wStats.recoveryTime.current;

        atk.timer -= dt;

        if (atk.timer <= 0) {
          if (atk.phase === 'prep') {
            if (castTime > 0) {
              atk.phase = 'cast';
              atk.timer = castTime;
              atk.totalDuration = castTime;
            } else {
              this.executeHit(id, atk.weaponId, world, physics);
              atk.phase = 'recovery';
              atk.timer = recoveryTime;
              atk.totalDuration = recoveryTime;
            }
          } else if (atk.phase === 'cast') {
            this.executeHit(id, atk.weaponId, world, physics);
            atk.phase = 'recovery';
            atk.timer = recoveryTime;
            atk.totalDuration = recoveryTime;
          } else {
            activeAttacks.attacks.splice(i, 1);
          }
        }
      }
    }
  }

  private executeHit(
    attackerId: string,
    weaponId: string,
    world: World,
    physics: PhysicsSystem
  ): void {
    const wStats = world.getComponent(weaponId, 'weaponStats');
    const wZone = world.getComponent(weaponId, 'weaponZone');

    if (!wStats || !wZone) return;

    const targetIds = physics.checkWeaponHits(attackerId, wZone, world);

    const baseDamage = wStats.baseDamage.current;
    const minMultiplier = wStats.minMultiplier;
    const maxMultiplier = wStats.maxMultiplier;
    const critChance = wStats.critChance;
    const critMultiplier = wStats.critMultiplier;

    for (const targetId of targetIds) {
      const targetHealth = world.getComponent(targetId, 'health');
      if (!targetHealth || !targetHealth.isAlive) continue;

      const mult = minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
      let rawDamage = baseDamage * mult;
      if (Math.random() < critChance) {
        rawDamage *= critMultiplier;
      }

      // Учет брони цели из слота экипировки
      const targetEquip = world.getComponent(targetId, 'equip');
      let defense = 0;
      let flatReduction = 0;

      if (targetEquip) {
        for (const area of targetEquip.equipmentAreas) {
          for (const itemId of area.itemIds) {
            const aStats = world.getComponent(itemId, 'armorStats');
            if (aStats) {
              defense += aStats.defense.current;
              flatReduction += aStats.flatReduction.current;
            }
          }
        }
      }

      const mitigatedDamage = rawDamage * (1 - Math.min(0.9, Math.max(0, defense / 100)));
      const finalDamage = Math.max(0, Math.round(mitigatedDamage - flatReduction));

      applyDamage(world, targetId, finalDamage);
    }
  }
}
