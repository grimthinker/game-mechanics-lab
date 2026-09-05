import { ArmorConfig, WeaponConfig } from '../types';
import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';

export class AttackSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith('equip', 'activeAttacks', 'health', 'input', 'healthStats');

    for (const [id, { equip, activeAttacks, health, input, healthStats }] of entities) {
      if (!health.isAlive || healthStats.hp.current <= 0) continue;

      if (input.wantsAttack && !input.isRunning) {
        const busySlots = new Set(activeAttacks.attacks.map((a) => a.slotIndex));
        let chosenSlotIndex = -1;

        if (input.attackSlotIndex !== undefined) {
          const slot = equip.slots[input.attackSlotIndex];
          if (slot && slot.type === 'weapon' && slot.itemId !== null && !busySlots.has(input.attackSlotIndex)) {
            chosenSlotIndex = input.attackSlotIndex;
          }
        } else {
          chosenSlotIndex = equip.slots.findIndex(
            (s, idx) => s.type === 'weapon' && s.itemId !== null && !busySlots.has(idx)
          );
        }

        if (chosenSlotIndex !== -1) {
          const weaponSlot = equip.slots[chosenSlotIndex];
          const weaponId = weaponSlot.itemId!;
          const wStats = world.getComponent(weaponId, 'weaponStats');
          const wItem = world.getComponent(weaponId, 'item');
          const wCfg = wItem?.config as WeaponConfig | undefined;
          const prepTime = wStats?.prepTime.current ?? wCfg?.prepTime;

          if (prepTime !== undefined) {
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

        const slot = equip.slots[atk.slotIndex];
        const isStillEquipped = slot && slot.type === 'weapon' && slot.itemId === atk.weaponId;
        const wStats = isStillEquipped ? world.getComponent(atk.weaponId, 'weaponStats') : undefined;
        const wItem = isStillEquipped ? world.getComponent(atk.weaponId, 'item') : undefined;
        const wCfg = wItem?.config as WeaponConfig | undefined;

        if (!isStillEquipped || (!wStats && !wCfg)) {
          activeAttacks.attacks.splice(i, 1);
          continue;
        }

        const castTime = wStats?.castTime.current ?? wCfg?.castTime ?? 0;
        const recoveryTime = wStats?.recoveryTime.current ?? wCfg?.recoveryTime ?? 0.3;

        atk.timer -= dt;

        if (atk.timer <= 0) {
          if (atk.phase === 'prep') {
            if (castTime > 0) {
              atk.phase = 'cast';
              atk.timer = castTime;
              atk.totalDuration = castTime;
            } else {
              this.executeHit(id, atk.weaponId, world, physics);
              health.hitFlashTimer = 6;
              atk.phase = 'recovery';
              atk.timer = recoveryTime;
              atk.totalDuration = recoveryTime;
            }
          } else if (atk.phase === 'cast') {
            this.executeHit(id, atk.weaponId, world, physics);
            health.hitFlashTimer = 6;
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
    const wZone = world.getComponent(weaponId, 'weaponZone') ?? (world.getComponent(weaponId, 'item')?.config as WeaponConfig)?.zone;
    const wItem = world.getComponent(weaponId, 'item');
    const wCfg = wItem?.config as WeaponConfig | undefined;

    if (!wZone) return;

    const effectiveWeapon: WeaponConfig = {
      id: weaponId,
      name: wItem?.name ?? 'Weapon',
      weight: 1,
      radius: 16,
      prepTime: wStats?.prepTime.current ?? wCfg?.prepTime ?? 0.2,
      recoveryTime: wStats?.recoveryTime.current ?? wCfg?.recoveryTime ?? 0.3,
      prepTurnSlow: wStats?.prepTurnSlow.current ?? wCfg?.prepTurnSlow ?? 0.5,
      recoveryTurnSlow: wStats?.recoveryTurnSlow.current ?? wCfg?.recoveryTurnSlow ?? 0.8,
      prepMoveSlow: wStats?.prepMoveSlow.current ?? wCfg?.prepMoveSlow ?? 0.5,
      recoveryMoveSlow: wStats?.recoveryMoveSlow.current ?? wCfg?.recoveryMoveSlow ?? 0.8,
      baseDamage: wStats?.baseDamage.current ?? wCfg?.baseDamage ?? 20,
      minMultiplier: wStats?.minMultiplier.current ?? wCfg?.minMultiplier ?? 0.8,
      maxMultiplier: wStats?.maxMultiplier.current ?? wCfg?.maxMultiplier ?? 1.2,
      critChance: wStats?.critChance.current ?? wCfg?.critChance ?? 0.1,
      critMultiplier: wStats?.critMultiplier.current ?? wCfg?.critMultiplier ?? 2.0,
      zone: wZone,
    };

    const targetIds = physics.checkWeaponHits(attackerId, effectiveWeapon, world);

    const baseDamage = wStats?.baseDamage.current ?? wCfg?.baseDamage ?? 20;
    const minMultiplier = wStats?.minMultiplier.current ?? wCfg?.minMultiplier ?? 0.8;
    const maxMultiplier = wStats?.maxMultiplier.current ?? wCfg?.maxMultiplier ?? 1.2;
    const critChance = wStats?.critChance.current ?? wCfg?.critChance ?? 0.1;
    const critMultiplier = wStats?.critMultiplier.current ?? wCfg?.critMultiplier ?? 2.0;

    for (const targetId of targetIds) {
      const targetHealth = world.getComponent(targetId, 'health');
      const targetStats = world.getComponent(targetId, 'healthStats');
      if (!targetHealth || !targetHealth.isAlive || !targetStats) continue;

      const mult = minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
      let rawDamage = baseDamage * mult;
      if (Math.random() < critChance) {
        rawDamage *= critMultiplier;
      }

      // Учет брони цели из слота экипировки
      const targetEquip = world.getComponent(targetId, 'equip');
      let defense = 0;
      let flatReduction = 0;

      const armorSlot = targetEquip?.slots.find((s) => s.type === 'armor' && s.itemId !== null);
      if (armorSlot && armorSlot.itemId) {
        const aStats = world.getComponent(armorSlot.itemId, 'armorStats');
        const aItem = world.getComponent(armorSlot.itemId, 'item');
        const aCfg = aItem?.config as ArmorConfig | undefined;

        defense = aStats?.defense.current ?? aCfg?.defense ?? 0;
        flatReduction = aStats?.flatReduction.current ?? aCfg?.flat_reduction ?? 0;
      }

      const mitigatedDamage = rawDamage * (1 - Math.min(0.9, Math.max(0, defense / 100)));
      const finalDamage = Math.max(0, Math.round(mitigatedDamage - flatReduction));

      targetStats.hp.current = Math.max(0, targetStats.hp.current - finalDamage);
      targetHealth.hitFlashTimer = 6;
    }
  }
}