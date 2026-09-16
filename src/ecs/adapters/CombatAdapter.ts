import { World } from '../World';
import { EntityId, HitZoneConfig, WeaponStatsComponent, ArmorStatsComponent } from '../types';
import { AttackStatus } from '../../ai/core';
import { findActiveBrain } from '../utils/anatomy';

export class CombatAdapter {
  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  private getComponent<K extends keyof import('../types').EntityComponents>(key: K) {
    return this.world.getComponent(this.id, key);
  }

  private getInputIfActive() {
    const health = this.getComponent('health');
    if (!health?.isAlive) return undefined;
    return this.getComponent('input');
  }

  public get weaponStats(): WeaponStatsComponent | undefined {
    return this.getComponent('weaponStats');
  }

  public get weaponZone(): HitZoneConfig | undefined {
    return this.getComponent('weaponZone');
  }

  public get armorStats(): ArmorStatsComponent | undefined {
    return this.getComponent('armorStats');
  }

  public get hp(): number {
    return this.getComponent('health')?.current ?? 0;
  }

  public get maxHp(): number {
    return this.getComponent('health')?.max.current ?? 0;
  }

  public get isAlive(): boolean {
    return this.getComponent('health')?.isAlive ?? false;
  }

  public get attackStatus(): AttackStatus {
    const activeAttacks = this.getComponent('activeAttacks');
    const currentAttack = activeAttacks?.attacks[0];
    if (!currentAttack) return 'idle';

    if (currentAttack.phase === 'prep' || currentAttack.phase === 'cast') {
      return 'attacking';
    }
    if (currentAttack.phase === 'recovery') {
      return 'cooldown';
    }
    return 'idle';
  }

  public attack(targetId?: string, slotIndex?: number): boolean {
    const input = this.getInputIfActive();
    if (input) {
      input.wantsAttack = true;
      input.attackSlotIndex = slotIndex;
    }
    return true;
  }

  public cancelAttack(slotIndex?: number): void {
    const activeAttacks = this.getComponent('activeAttacks');
    if (!activeAttacks) return;
    if (slotIndex !== undefined) {
      activeAttacks.attacks = activeAttacks.attacks.filter((a) => a.slotIndex !== slotIndex);
    } else {
      activeAttacks.attacks = [];
    }
  }

  public isSlotBusy(slotIndex: number): boolean {
    const activeAttacks = this.getComponent('activeAttacks');
    return activeAttacks?.attacks.some((a) => a.slotIndex === slotIndex) ?? false;
  }
}
