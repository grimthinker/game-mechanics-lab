import { World } from './ecs/World';
import {
  EntityId,
  IMovable,
  EntityController,
  StandardRadius,
  ItemData,
  OwnershipComponent,
  EquipmentComponent,
  InteractionSlotsComponent,
  InteractionPhase,
  InteractionActionComponent,
  CreatureMovementMode,
  CreatureDirectionMode,
  CreatureActionMode,
  InventoryComponent,
} from './ecs/types';
import { EntityUtils, BTLogicComponent, AttackStatus, BehaviorStatsConfig } from './ai/core';
import { LOGIC_CONFIG } from './ai/config';
import { Point } from './types';
import { Radians } from './utils';
import { calculateTotalEntityWeight, getAggregatedInteractionSlots } from './ecs/utils/hierarchy';
import { findActiveBrain } from './ecs/utils/anatomy';

// Под-адаптеры по доменам
import { MovementAdapter } from './ecs/adapters/MovementAdapter';
import { CombatAdapter } from './ecs/adapters/CombatAdapter';
import { InventoryAdapter } from './ecs/adapters/InventoryAdapter';

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  private movementAdapter: MovementAdapter;
  private combatAdapter: CombatAdapter;
  private inventoryAdapter: InventoryAdapter;

  constructor(
    public readonly id: EntityId,
    private world: World
  ) {
    this.movementAdapter = new MovementAdapter(id, world);
    this.combatAdapter = new CombatAdapter(id, world);
    this.inventoryAdapter = new InventoryAdapter(id, world);
  }

  private getComponent<K extends keyof import('./ecs/types').EntityComponents>(key: K) {
    return this.world.getComponent(this.id, key);
  }

  // --- Делегируемые геттеры и свойства (Фасад) ---
  public get itemData(): ItemData | undefined {
    return this.getComponent('item');
  }
  public get inventory(): InventoryComponent | undefined {
    return this.inventoryAdapter.inventory;
  }
  public get weaponStats() {
    return this.combatAdapter.weaponStats;
  }
  public get weaponZone() {
    return this.combatAdapter.weaponZone;
  }
  public get armorStats() {
    return this.combatAdapter.armorStats;
  }
  public get ownership(): OwnershipComponent | undefined {
    return this.getComponent('ownership');
  }

  public get behavior(): string {
    return this.getComponent('aiStats')?.behavior.current ?? 'IdleTree';
  }
  public get stance() {
    return this.movementAdapter.stance;
  }
  public get desiredStance() {
    return this.movementAdapter.desiredStance;
  }
  public get movementMode(): CreatureMovementMode {
    return this.movementAdapter.movementMode;
  }
  public get directionMode(): CreatureDirectionMode {
    return this.movementAdapter.directionMode;
  }
  public get actionMode(): CreatureActionMode {
    return this.movementAdapter.actionMode;
  }

  public get targetLookAngle(): Radians | undefined {
    return this.getComponent('input')?.targetLookAngle;
  }
  public get pos(): Point {
    return this.movementAdapter.pos;
  }
  public get angle(): Radians {
    return this.movementAdapter.angle;
  }
  public get radius(): StandardRadius {
    return this.movementAdapter.radius as StandardRadius;
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
  public get totalWeight(): number {
    return calculateTotalEntityWeight(this.world, this.id);
  }
  public get isSolid(): boolean {
    return this.getComponent('physicsStats')?.isSolid ?? true;
  }

  public get hp() {
    return this.combatAdapter.hp;
  }
  public get maxHp() {
    return this.combatAdapter.maxHp;
  }
  public get isAlive() {
    return this.combatAdapter.isAlive;
  }

  public get maxSpeed() {
    return this.movementAdapter.maxSpeed;
  }
  public get maxTurnSpeed() {
    return this.movementAdapter.maxTurnSpeed;
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
    return this.getComponent('movementStats')?.runTurnMultiplier ?? 0.7;
  }
  public get walkTurnMultiplier(): number {
    return this.getComponent('movementStats')?.walkTurnMultiplier ?? 1.1;
  }
  public get turnInPlaceTurnMultiplier(): number {
    return this.getComponent('movementStats')?.turnInPlaceTurnMultiplier ?? 1.2;
  }
  public get crouchTurnMultiplier(): number {
    return this.getComponent('movementStats')?.crouchTurnMultiplier ?? 1.2;
  }
  public get proneSpeedMultiplier(): number {
    return this.getComponent('movementStats')?.proneSpeedMultiplier ?? 0.2;
  }
  public get proneTurnMultiplier(): number {
    return this.getComponent('movementStats')?.proneTurnMultiplier ?? 0.3;
  }
  public get proneStealthMultiplier(): number {
    return this.getComponent('stealthStats')?.proneStealthMultiplier ?? 3.0;
  }
  public get isProne(): boolean {
    return this.stance === 'prone';
  }
  public get isCrouching(): boolean {
    return this.stance === 'crouching';
  }
  public get isStanding(): boolean {
    return this.stance === 'standing';
  }

  public get equip(): EquipmentComponent | undefined {
    return this.inventoryAdapter.equip;
  }
  public get interactionSlots(): InteractionSlotsComponent | undefined {
    return this.inventoryAdapter.interactionSlots;
  }
  public get interactionAction(): InteractionActionComponent | undefined {
    return this.inventoryAdapter.interactionAction;
  }
  public get isInteracting() {
    return this.inventoryAdapter.isInteracting;
  }
  public get interactionPhase() {
    return this.inventoryAdapter.interactionPhase;
  }

  public get perception(): import('./ecs/types').PerceptionComponent | undefined {
    return this.getComponent('perception');
  }
  public get brain(): BTLogicComponent | undefined {
    let b = this.getComponent('brain') as BTLogicComponent | undefined;
    if (!b) {
      const activeBrainId = findActiveBrain(this.world, this.id);
      if (activeBrainId) {
        b = this.world.getComponent(activeBrainId, 'brain') as BTLogicComponent | undefined;
      }
    }
    return b;
  }
  public get attackStatus() {
    return this.combatAdapter.attackStatus;
  }
  public get timeScaleMultiplier(): number {
    return this.getComponent('timeScale')?.multiplier.current ?? 1.0;
  }
  public get attackPhase(): 'prep' | 'cast' | 'recovery' | null {
    const activeAttacks = this.getComponent('activeAttacks');
    return activeAttacks?.attacks[0]?.phase ?? null;
  }
  public get hasPendingAttackRequest(): boolean {
    const input = this.getComponent('input');
    return input?.wantsAttack ?? false;
  }
  public get aiStats(): BehaviorStatsConfig {
    const aiStats = this.getComponent('aiStats');
    const custom = aiStats?.stats;
    return {
      detectDist: custom?.detectDist ?? LOGIC_CONFIG.detectDist,
      loseTargetDist: custom?.loseTargetDist ?? LOGIC_CONFIG.loseTargetDist,
      inPosDist: custom?.inPosDist ?? LOGIC_CONFIG.inPosDist,
      followStopDist: custom?.followStopDist ?? LOGIC_CONFIG.followStopDist,
      followUpDist: custom?.followUpDist ?? LOGIC_CONFIG.followUpDist,
    };
  }

  // --- Делегируемые команды управления ---
  public setDesiredMoveVector(vec: Point | null): void {
    this.movementAdapter.setDesiredMoveVector(vec);
  }

  public setMovementInput(forward: -1 | 0 | 1, strafe: -1 | 0 | 1): void {
    const input = this.getComponent('input');
    if (input && this.isAlive) {
      input.moveForward = forward;
      input.moveStrafe = strafe;
      input.isMovingForward = forward === 1;
    }
  }

  public setTargetLookAngle(angle?: Radians): void {
    const input = this.getComponent('input');
    if (input && this.isAlive) {
      input.targetLookAngle = angle;
    }
  }

  public startMovingForward(): void {
    this.movementAdapter.startMovingForward();
  }
  public stopMovingForward(): void {
    this.movementAdapter.stopMovingForward();
  }
  public startTurning(direction: -1 | 1, ratio = 1): void {
    this.movementAdapter.startTurning(direction, ratio);
  }
  public stopTurning(): void {
    this.movementAdapter.stopTurning();
  }
  public startRunning(): void {
    this.movementAdapter.startRunning();
  }
  public stopRunning(): void {
    this.movementAdapter.stopRunning();
  }
  public setDesiredStance(stance: import('./ecs/types').BaseCreatureStance): void {
    this.movementAdapter.setDesiredStance(stance);
  }
  public startCrouching(): void {
    this.setDesiredStance('crouching');
  }
  public stopCrouching(): void {
    if (this.desiredStance === 'crouching') this.setDesiredStance('standing');
  }
  public startProne(): void {
    this.setDesiredStance('prone');
  }
  public stopProne(): void {
    if (this.desiredStance === 'prone') this.setDesiredStance('standing');
  }
  public startWalking(): void {
    const input = this.getComponent('input');
    if (input && this.isAlive) input.isSlowWalking = true;
  }
  public stopWalking(): void {
    const input = this.getComponent('input');
    if (input) input.isSlowWalking = false;
  }
  public toggleWalking(): void {
    const input = this.getComponent('input');
    if (input && this.isAlive) input.isSlowWalking = !input.isSlowWalking;
  }

  public stop(): boolean {
    return this.movementAdapter.stop();
  }
  public attack(targetId?: string, slotIndex?: number): boolean {
    return this.combatAdapter.attack(targetId, slotIndex);
  }
  public cancelAttack(slotIndex?: number): void {
    this.combatAdapter.cancelAttack(slotIndex);
  }
  public pickup(targetItemId: EntityId): boolean {
    return this.inventoryAdapter.pickup(targetItemId);
  }
  public cancelInteraction(): void {
    this.inventoryAdapter.cancelInteraction();
  }

  public isSlotBusy(slotIndex: number): boolean {
    return this.combatAdapter.isSlotBusy(slotIndex);
  }

  public isWeaponBusy(weaponId: EntityId): boolean {
    const activeAttacks = this.getComponent('activeAttacks');
    return activeAttacks?.attacks.some((a) => a.weaponId === weaponId) ?? false;
  }

  public getFreeWeaponSlots(): { slotIndex: number; weaponId: EntityId }[] {
    const aggSlots = getAggregatedInteractionSlots(this.world, this.id);
    const activeAttacks = this.getComponent('activeAttacks');
    const busyGlobalIndices = new Set(activeAttacks?.attacks.map((a: any) => a.slotIndex));
    const freeSlots: { slotIndex: number; weaponId: EntityId }[] = [];

    aggSlots.forEach((info: any) => {
      if (info.slot.itemId !== null && !busyGlobalIndices.has(info.globalSlotIndex)) {
        const item = this.world.getComponent(info.slot.itemId, 'item');
        if (item?.type === 'weapon') {
          freeSlots.push({ slotIndex: info.globalSlotIndex, weaponId: info.slot.itemId });
        }
      }
    });

    return freeSlots;
  }

  public getPos(): Point {
    return this.pos;
  }
}
