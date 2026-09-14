import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { applyDamage } from '../utils/health';
import { getAllEquippedDescendants, getAggregatedInteractionSlots } from '../utils/hierarchy';

export class AttackSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    // В новой архитектуре слоты могут быть на частях тела, поэтому запрашиваем корневые сущности с activeAttacks
    const entities = world.getEntitiesWith('activeAttacks', 'health', 'input');

    for (const [id, { activeAttacks, health, input }] of entities) {
      if (!health.isAlive) continue;

      const aggSlots = getAggregatedInteractionSlots(world, id);

      if (input.wantsAttack && !input.isRunning) {
        const busyGlobalIndices = new Set(activeAttacks.attacks.map((a) => a.slotIndex));
        let chosenGlobalIndex = -1;

        if (input.attackSlotIndex !== undefined) {
          const slotInfo = aggSlots[input.attackSlotIndex];
          if (
            slotInfo &&
            slotInfo.slot.itemId !== null &&
            !busyGlobalIndices.has(input.attackSlotIndex)
          ) {
            const item = world.getComponent(slotInfo.slot.itemId, 'item');
            if (item?.type === 'weapon') {
              chosenGlobalIndex = input.attackSlotIndex;
            }
          }
        } else {
          chosenGlobalIndex = aggSlots.findIndex((info) => {
            if (info.slot.itemId === null || busyGlobalIndices.has(info.globalSlotIndex))
              return false;
            const item = world.getComponent(info.slot.itemId, 'item');
            return item?.type === 'weapon';
          });
        }

        if (chosenGlobalIndex !== -1) {
          const weaponSlotInfo = aggSlots[chosenGlobalIndex];
          const weaponId = weaponSlotInfo.slot.itemId!;
          const wStats = world.getComponent(weaponId, 'weaponStats');

          if (wStats) {
            const prepTime = wStats.prepTime.current;
            activeAttacks.attacks.push({
              weaponId,
              slotIndex: chosenGlobalIndex,
              partId: weaponSlotInfo.partId,
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

        let isStillEquipped = false;
        if (atk.partId) {
          const slotsComp = world.getComponent(atk.partId, 'interactionSlots');
          // Если часть тела оторвали и у нее больше нет компонента или слота, атака отменится
          if (slotsComp) {
            // Для восстановления локального индекса ищем слот по weaponId
            const slot = slotsComp.slots.find((s) => s.itemId === atk.weaponId);
            isStillEquipped = !!slot;
          }
        } else {
          // Fallback на старую логику для совместимости, если partId нет
          const slotsComp = world.getComponent(id, 'interactionSlots');
          if (slotsComp) {
            const slot = slotsComp.slots[atk.slotIndex];
            isStillEquipped = slot && slot.itemId === atk.weaponId;
          }
        }

        const wStats = isStillEquipped
          ? world.getComponent(atk.weaponId, 'weaponStats')
          : undefined;

        if (!isStillEquipped || !wStats) {
          activeAttacks.attacks.splice(i, 1);
          continue;
        }

        const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
        const localDt = dt * ts;

        const castTime = wStats.castTime.current;
        const recoveryTime = wStats.recoveryTime.current;

        atk.timer -= localDt;

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

      // Учет брони цели: собственные характеристики существа + надетая экипировка
      let defense = 0;
      let flatReduction = 0;

      const selfArmor = world.getComponent(targetId, 'armorStats');
      if (selfArmor) {
        defense += selfArmor.defense.current;
        flatReduction += selfArmor.flatReduction.current;
      }

      const allEquippedItemIds = getAllEquippedDescendants(world, targetId);
      for (const itemId of allEquippedItemIds) {
        const aStats = world.getComponent(itemId, 'armorStats');
        if (aStats) {
          defense += aStats.defense.current;
          flatReduction += aStats.flatReduction.current;
        }
      }

      const mitigatedDamage = rawDamage * (1 - Math.min(0.9, Math.max(0, defense / 100)));
      const finalDamage = Math.max(0, Math.round(mitigatedDamage - flatReduction));

      applyDamage(world, targetId, finalDamage);
    }
  }
}
