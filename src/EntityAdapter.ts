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
} from './ecs/types';
import { EntityUtils, BTLogicComponent, AttackStatus, BehaviorStatsConfig } from './ai/core';
import { LOGIC_CONFIG } from './ai/config';
import { AISystem } from './ecs/systems/AISystem';
import { Point } from './types';
import { Radians } from './utils';

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  public get itemData(): ItemData | undefined {
    return this.world.getComponent(this.id, 'item');
  }
  public get inventory(): InventoryComponent | undefined {
    return this.world.getComponent(this.id, 'inventory');
  }
  public get weaponStats(): WeaponStatsComponent | undefined {
    return this.world.getComponent(this.id, 'weaponStats');
  }
  public get weaponZone(): HitZoneConfig | undefined {
    return this.world.getComponent(this.id, 'weaponZone');
  }
  public get armorStats(): ArmorStatsComponent | undefined {
    return this.world.getComponent(this.id, 'armorStats');
  }
  public get ownership(): OwnershipComponent | undefined {
    return this.world.getComponent(this.id, 'ownership');
  }
  public get behavior(): string {
    return this.world.getComponent(this.id, 'aiStats')?.behavior.current ?? 'IdleTree';
  }
  public get state(): CreatureState {
    return this.world.getComponent(this.id, 'meta')?.state ?? 'idle';
  }
  public get pos(): Point {
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }
  public get angle(): Radians {
    const transform = this.world.getComponent(this.id, 'transform');
    return (transform ? transform.angle : 0) as Radians;
  }
  public get radius(): StandardRadius {
    return (
      (this.world.getComponent(this.id, 'physicsStats')?.radius.current as StandardRadius) ?? 16
    );
  }
  public get baseRadius(): StandardRadius {
    return (
      (this.world.getComponent(this.id, 'physicsStats')?.radius.base as StandardRadius) ??
      this.radius
    );
  }
  public get weight(): number {
    return this.world.getComponent(this.id, 'physicsStats')?.weight.current ?? 1;
  }
  public get baseWeight(): number {
    return this.world.getComponent(this.id, 'physicsStats')?.weight.base ?? this.weight;
  }
  public get isSolid(): boolean {
    return this.world.getComponent(this.id, 'physicsStats')?.isSolid ?? true;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'health')?.current ?? 0;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'health')?.max.current ?? 0;
  }
  public get isAlive(): boolean {
    const h = this.world.getComponent(this.id, 'health');
    return h ? (h.isAlive && h.current > 0) : false;
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'movementStats')?.maxSpeed.current ?? 0;
  }
  public get maxTurnSpeed(): Radians {
    return (this.world.getComponent(this.id, 'movementStats')?.maxTurnSpeed.current ?? 0) as Radians;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')?.currentSpeed ?? 0;
  }
  public get currentTurnSpeed(): Radians {
    return (this.world.getComponent(this.id, 'velocity')?.currentTurnSpeed ?? 0) as Radians;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.runSpeedMultiplier ?? 1.5;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.crouchSpeedMultiplier ?? 0.5;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.crouchStealthMultiplier ?? 1.5;
  }
  public get stealthPower(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.stealthPower.current ?? 10;
  }
  public get baseStealthPower(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.stealthPower.base ?? this.stealthPower;
  }
  public get runStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.runStealthMultiplier ?? 0.5;
  }
  public get runTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.runTurnMultiplier ?? 0.8;
  }
  public get crouchTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.crouchTurnMultiplier ?? 1.2;
  }
  public get equip(): EquipComponent | undefined {
    return this.world.getComponent(this.id, 'equip');
  }
  public get brain(): BTLogicComponent | undefined {
    return this.world.getComponent(this.id, 'brain') as BTLogicComponent | undefined;
  }
  public get attack_status(): AttackStatus {
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
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
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
    return activeAttacks?.attacks[0]?.phase ?? null;
  }
  public get hasPendingAttackRequest(): boolean {
    const input = this.world.getComponent(this.id, 'input');
    return input?.wantsAttack ?? false;
  }
  public get ai_stats(): BehaviorStatsConfig {
    const aiStats = this.world.getComponent(this.id, 'aiStats');
    const custom = aiStats?.stats;
    return {
      detect_dist: custom?.detect_dist ?? LOGIC_CONFIG.detect_dist,
      lose_target_dist: custom?.lose_target_dist ?? LOGIC_CONFIG.lose_target_dist,
      in_pos_dist: custom?.in_pos_dist ?? LOGIC_CONFIG.in_pos_dist,
      follow_stop_dist: custom?.follow_stop_dist ?? LOGIC_CONFIG.follow_stop_dist,
      follow_up_dist: custom?.follow_up_dist ?? LOGIC_CONFIG.follow_up_dist,
    };
  }

  public startMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) input.isMovingForward = true;
  }
  public stopMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isMovingForward = false;
  }
  public startTurning(direction: -1 | 1, ratio = 1): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    const moveStats = this.world.getComponent(this.id, 'movementStats');
    const maxTurnSpeed = moveStats ? moveStats.maxTurnSpeed.current : (0 as Radians);
    const turnSpeed = (maxTurnSpeed * ratio) as Radians;
    if (input && health?.isAlive && this.hp > 0) {
      input.turnDirection = direction;
      input.turnSpeed = turnSpeed;
    }
  }
  public stopTurning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.turnDirection = 0;
    if (input) input.turnSpeed = 0 as Radians;
  }
  public startRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isRunning = true;
      input.isCrouching = false;
    }
  }
  public stopRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isRunning = false;
  }
  public startCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isCrouching = true;
      input.isRunning = false;
    }
  }
  public stopCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isCrouching = false;
  }

  public stop(): boolean {
    const input = this.world.getComponent(this.id, 'input');
    if (input) {
      input.isMovingForward = false;
      input.turnDirection = 0;
      input.turnSpeed = 0 as Radians;
      input.wantsAttack = false;
      input.attackSlotIndex = undefined;
    }
    return true;
  }
  public attack(_id_target?: string, slotIndex?: number): boolean {
    const input = this.world.getComponent(this.id, 'input');
    if (input) {
      input.wantsAttack = true;
      input.attackSlotIndex = slotIndex;
    }
    return true;
  }
  public cancelAttack(slotIndex?: number): void {
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
    if (!activeAttacks) return;
    if (slotIndex !== undefined) {
      activeAttacks.attacks = activeAttacks.attacks.filter((a) => a.slotIndex !== slotIndex);
    } else {
      activeAttacks.attacks = [];
    }
  }
  public isSlotBusy(slotIndex: number): boolean {
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
    return activeAttacks?.attacks.some((a) => a.slotIndex === slotIndex) ?? false;
  }
  public isWeaponBusy(weaponId: EntityId): boolean {
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
    return activeAttacks?.attacks.some((a) => a.weaponId === weaponId) ?? false;
  }
  public getFreeWeaponSlots(): { slotIndex: number; weaponId: EntityId }[] {
    const equip = this.world.getComponent(this.id, 'equip');
    const activeAttacks = this.world.getComponent(this.id, 'activeAttacks');
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
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }

  public setBehavior(newBehavior: string, aiSystem: AISystem): void {
    const aiStats = this.world.getComponent(this.id, 'aiStats');
    if (!aiStats || aiStats.behavior.current === newBehavior) return;

    aiStats.behavior.current = newBehavior;
    aiSystem.initBotBrain(this.world, this.id, newBehavior);

    this.stop();
    const input = this.world.getComponent(this.id, 'input');
    if (input) {
      input.isRunning = false;
      input.isCrouching = false;
    }
  }
}
