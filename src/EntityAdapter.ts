import { World } from './ecs/World';
import {
  EntityId,
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
  InputComponent,
  TransformComponent,
  HealthComponent,
  VelocityComponent,
  MovementStatsComponent,
  StealthStatsComponent,
  PhysicsStatsComponent,
  PerceptionComponent,
  ActiveAttackComponent,
  WeaponStatsComponent,
  HitZoneConfig,
  ArmorStatsComponent,
  BaseCreatureStance,
  CreatureStance,
} from './ecs/types';
import { EntityUtils, BTLogicComponent, AttackStatus, BehaviorStatsConfig } from './ai/core';
import { LOGIC_CONFIG } from './ai/config';
import { Point, Vec3 } from './types';
import { Radians } from './utils';
import { calculateTotalEntityWeight, getAggregatedInteractionSlots } from './ecs/utils/hierarchy';
import { getEffectiveLogicBrain } from './ecs/utils/anatomy';

export class EntityAdapter {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    public readonly world: World
  ) {}

  public getComponent<K extends keyof import('./ecs/types').EntityComponents>(key: K) {
    return this.world.getComponent(this.id, key);
  }

  // --- Прямой доступ к компонентам сущности (Single Source of Truth) ---
  public get input(): InputComponent | undefined {
    return this.getComponent('input');
  }
  public get transform(): TransformComponent | undefined {
    return this.getComponent('transform');
  }
  public get health(): HealthComponent | undefined {
    return this.getComponent('health');
  }
  public get velocity(): VelocityComponent | undefined {
    return this.getComponent('velocity');
  }
  public get movementStats(): MovementStatsComponent | undefined {
    return this.getComponent('movementStats');
  }
  public get stealthStats(): StealthStatsComponent | undefined {
    return this.getComponent('stealthStats');
  }
  public get physicsStats(): PhysicsStatsComponent | undefined {
    return this.getComponent('physicsStats');
  }
  public get activeAttacks(): ActiveAttackComponent | undefined {
    return this.getComponent('activeAttacks');
  }
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
  public get equip(): EquipmentComponent | undefined {
    return this.getComponent('equip');
  }
  public get interactionSlots(): InteractionSlotsComponent | undefined {
    return this.getComponent('interactionSlots');
  }
  public get interactionAction(): InteractionActionComponent | undefined {
    return this.getComponent('interactionAction');
  }
  public get perception(): PerceptionComponent | undefined {
    return this.getComponent('perception');
  }
  public get brain(): BTLogicComponent | undefined {
    return getEffectiveLogicBrain(this.world, this.id);
  }

  // --- Read-Only вычисляемые свойства состояния ---
  public get isAlive(): boolean {
    return this.health?.isAlive ?? false;
  }
  public get hp(): number {
    return this.health?.current ?? 0;
  }
  public get maxHp(): number {
    return this.health?.max.current ?? 0;
  }
  public get pos(): Vec3 {
    const tr = this.transform;
    return tr ? { x: tr.x, y: tr.y, z: tr.z } : { x: 0, y: 0, z: 0 };
  }
  public get angle(): Radians {
    return this.transform?.angle ?? (0 as Radians);
  }
  public get radius(): number {
    return this.physicsStats?.radius.current ?? 0.4;
  }
  public get baseRadius(): number {
    return this.physicsStats?.radius.base ?? this.radius;
  }
  public get weight(): number {
    return this.physicsStats?.weight.current ?? 1;
  }
  public get baseWeight(): number {
    return this.physicsStats?.weight.base ?? this.weight;
  }
  public get totalWeight(): number {
    return calculateTotalEntityWeight(this.world, this.id);
  }
  public get isSolid(): boolean {
    return this.physicsStats?.isSolid ?? true;
  }

  public get maxSpeed(): number {
    return this.movementStats?.maxSpeed.current ?? 0;
  }
  public get maxTurnSpeed(): Radians {
    return (this.movementStats?.maxTurnSpeed.current ?? 0) as Radians;
  }
  public get currentSpeed(): number {
    return this.velocity?.currentSpeed ?? 0;
  }
  public get currentTurnSpeed(): Radians {
    return (this.velocity?.currentTurnSpeed ?? 0) as Radians;
  }

  public get stance(): CreatureStance {
    return this.getComponent('meta')?.stance ?? 'standing';
  }
  public get desiredStance(): BaseCreatureStance {
    return this.input?.desiredStance ?? 'standing';
  }
  public get movementMode(): CreatureMovementMode {
    return this.getComponent('meta')?.movementMode ?? 'immobile';
  }
  public get directionMode(): CreatureDirectionMode {
    return this.getComponent('meta')?.directionMode ?? 'immobile';
  }
  public get actionMode(): CreatureActionMode {
    return this.getComponent('meta')?.actionMode ?? 'idle';
  }

  public get targetLookAngle(): Radians | undefined {
    return this.input?.targetLookAngle;
  }
  public get isInteracting(): boolean {
    return this.interactionAction !== undefined;
  }
  public get interactionPhase(): InteractionPhase | null {
    return this.interactionAction?.phase ?? null;
  }

  public get attackStatus(): AttackStatus {
    const currentAttack = this.activeAttacks?.attacks[0];
    if (!currentAttack) return 'idle';
    if (currentAttack.phase === 'prep' || currentAttack.phase === 'cast') {
      return 'attacking';
    }
    if (currentAttack.phase === 'recovery') {
      return 'cooldown';
    }
    return 'idle';
  }

  public get attackPhase(): 'prep' | 'cast' | 'recovery' | null {
    return this.activeAttacks?.attacks[0]?.phase ?? null;
  }

  public get hasPendingAttackRequest(): boolean {
    return this.input?.wantsAttack ?? false;
  }

  public get timeScaleMultiplier(): number {
    return this.getComponent('timeScale')?.multiplier.current ?? 1.0;
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

  public isSlotBusy(slotIndex: number): boolean {
    return this.activeAttacks?.attacks.some((a) => a.slotIndex === slotIndex) ?? false;
  }

  public isWeaponBusy(weaponId: EntityId): boolean {
    return this.activeAttacks?.attacks.some((a) => a.weaponId === weaponId) ?? false;
  }

  public getFreeWeaponSlots(): { slotIndex: number; weaponId: EntityId }[] {
    const aggSlots = getAggregatedInteractionSlots(this.world, this.id);
    const activeAttacks = this.activeAttacks;
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

  public getPos(): Vec3 {
    return this.pos;
  }
}
