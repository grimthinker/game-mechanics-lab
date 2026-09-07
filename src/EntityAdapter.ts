import { World } from './ecs/World';
import {
  CreatureState,
  EntityId,
  IMovable,
  EquipComponent,
  InventoryComponent,
  EntityController,
  StandardRadius,
  ItemData,
  OwnershipComponent,
  ArmorStatsComponent,
  WeaponStatsComponent,
  HitZoneConfig,
  EntityComponents,
} from './ecs/types';
import { EntityUtils, BTLogicComponent, AttackStatus, BehaviorStatsConfig } from './ai/core';
import { LOGIC_CONFIG } from './ai/config';
import { Point } from './types';
import { Radians } from './utils';

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  // --- Вспомогательные приватные методы (DOD Proxy Helpers) ---
  private getComponent<K extends keyof EntityComponents>(key: K): EntityComponents[K] | undefined {
    return this.world.getComponent(this.id, key);
  }

  private getInputIfActive() {
    const health = this.getComponent('health');
    if (!health?.isAlive) return undefined;
    return this.getComponent('input');
  }

  // --- Геттеры состояния (Read-Only View) ---
  public get itemData(): ItemData | undefined {
    return this.getComponent('item');
  }
  public get inventory(): InventoryComponent | undefined {
    return this.getComponent('inventory');
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
  public get ownership(): OwnershipComponent | undefined {
    return this.getComponent('ownership');
  }
  public get behavior(): string {
    return this.getComponent('aiStats')?.behavior.current ?? 'IdleTree';
  }
  public get state(): CreatureState {
    return this.getComponent('meta')?.state ?? 'idle';
  }
  public get pos(): Point {
    const transform = this.getComponent('transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }
  public get angle(): Radians {
    const transform = this.getComponent('transform');
    return (transform ? transform.angle : 0) as Radians;
  }
  public get radius(): StandardRadius {
    return (this.getComponent('physicsStats')?.radius.current as StandardRadius) ?? 16;
  }
  public get baseRadius(): StandardRadius {
    return (this.getComponent('physicsStats')?.radius.base as StandardRadius) ?? this.radius;
  }
  public get weight(): number {
    return this.getComponent('physicsStats')?.weight.current ?? 1;
  }
  public get baseWeight(): number {
    return this.getComponent('physicsStats')?.weight.base ?? this.weight;
  }
  public get isSolid(): boolean {
    return this.getComponent('physicsStats')?.isSolid ?? true;
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
  public get maxSpeed(): number {
    return this.getComponent('movementStats')?.maxSpeed.current ?? 0;
  }
  public get maxTurnSpeed(): Radians {
    return (this.getComponent('movementStats')?.maxTurnSpeed.current ?? 0) as Radians;
  }
  public get currentSpeed(): number {
    return this.getComponent('velocity')?.currentSpeed ?? 0;
  }
  public get currentTurnSpeed(): Radians {
    return (this.getComponent('velocity')?.currentTurnSpeed ?? 0) as Radians;
  }
  public get runSpeedMultiplier(): number {
    return this.getComponent('movementStats')?.runSpeedMultiplier ?? 1.5;
  }
  public get crouchSpeedMultiplier(): number {
    return this.getComponent('movementStats')?.crouchSpeedMultiplier ?? 0.5;
  }
  public get crouchStealthMultiplier(): number {
    return this.getComponent('stealthStats')?.crouchStealthMultiplier ?? 1.5;
  }
  public get stealthPower(): number {
    return this.getComponent('stealthStats')?.stealthPower.current ?? 10;
  }
  public get baseStealthPower(): number {
    return this.getComponent('stealthStats')?.stealthPower.base ?? this.stealthPower;
  }
  public get runStealthMultiplier(): number {
    return this.getComponent('stealthStats')?.runStealthMultiplier ?? 0.5;
  }
  public get runTurnMultiplier(): number {
    return this.getComponent('movementStats')?.runTurnMultiplier ?? 0.8;
  }
  public get crouchTurnMultiplier(): number {
    return this.getComponent('movementStats')?.crouchTurnMultiplier ?? 1.2;
  }
  public get equip(): EquipComponent | undefined {
    return this.getComponent('equip');
  }
  public get brain(): BTLogicComponent | undefined {
    return this.getComponent('brain') as BTLogicComponent | undefined;
  }
  public get attack_status(): AttackStatus {
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
  public get attack_phase(): 'prep' | 'cast' | 'recovery' | null {
    const activeAttacks = this.getComponent('activeAttacks');
    return activeAttacks?.attacks[0]?.phase ?? null;
  }
  public get hasPendingAttackRequest(): boolean {
    const input = this.getComponent('input');
    return input?.wantsAttack ?? false;
  }
  public get ai_stats(): BehaviorStatsConfig {
    const aiStats = this.getComponent('aiStats');
    const custom = aiStats?.stats;
    return {
      detect_dist: custom?.detect_dist ?? LOGIC_CONFIG.detect_dist,
      lose_target_dist: custom?.lose_target_dist ?? LOGIC_CONFIG.lose_target_dist,
      in_pos_dist: custom?.in_pos_dist ?? LOGIC_CONFIG.in_pos_dist,
      follow_stop_dist: custom?.follow_stop_dist ?? LOGIC_CONFIG.follow_stop_dist,
      follow_up_dist: custom?.follow_up_dist ?? LOGIC_CONFIG.follow_up_dist,
    };
  }

  // --- Команды управления (Agent Controller API) ---
  public startMovingForward(): void {
    const input = this.getInputIfActive();
    if (input) input.isMovingForward = true;
  }
  public stopMovingForward(): void {
    const input = this.getComponent('input');
    if (input) input.isMovingForward = false;
  }
  public startTurning(direction: -1 | 1, ratio = 1): void {
    const input = this.getInputIfActive();
    if (input) {
      input.turnDirection = direction;
      input.turnRatio = Math.max(0, Math.min(1, ratio));
    }
  }
  public stopTurning(): void {
    const input = this.getComponent('input');
    if (input) {
      input.turnDirection = 0;
      input.turnRatio = 0;
    }
  }
  public startRunning(): void {
    const input = this.getInputIfActive();
    if (input) {
      input.isRunning = true;
      input.isCrouching = false;
    }
  }
  public stopRunning(): void {
    const input = this.getComponent('input');
    if (input) input.isRunning = false;
  }
  public startCrouching(): void {
    const input = this.getInputIfActive();
    if (input) {
      input.isCrouching = true;
      input.isRunning = false;
    }
  }
  public stopCrouching(): void {
    const input = this.getComponent('input');
    if (input) input.isCrouching = false;
  }

  public stop(): boolean {
    const input = this.getComponent('input');
    if (input) {
      input.isMovingForward = false;
      input.turnDirection = 0;
      input.turnRatio = 0;
      input.wantsAttack = false;
      input.attackSlotIndex = undefined;
    }
    return true;
  }
  public attack(_id_target?: string, slotIndex?: number): boolean {
    const input = this.getComponent('input');
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
  public isWeaponBusy(weaponId: EntityId): boolean {
    const activeAttacks = this.getComponent('activeAttacks');
    return activeAttacks?.attacks.some((a) => a.weaponId === weaponId) ?? false;
  }
  public getFreeWeaponSlots(): { slotIndex: number; weaponId: EntityId }[] {
    const equip = this.getComponent('equip');
    const activeAttacks = this.getComponent('activeAttacks');
    if (!equip) return [];

    const busySlots = new Set(activeAttacks?.attacks.map((a) => a.slotIndex));
    const freeSlots: { slotIndex: number; weaponId: EntityId }[] = [];

    equip.slots.forEach((slot, index) => {
      if (slot.type === 'weapon' && slot.itemId !== null && !busySlots.has(index)) {
        freeSlots.push({ slotIndex: index, weaponId: slot.itemId });
      }
    });

    return freeSlots;
  }
  public getPos(): Point {
    return this.pos;
  }
}
