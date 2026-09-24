import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, EntityId, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from '../types';
import { GAMEPLAY_CONFIG } from '../../config/gameplayConfig';
import { Radians, calculateThrowVelocity } from '../../utils';
import {
  calculateTotalEntityWeight,
  getAggregatedInteractionSlots,
  AggregatedSlot,
} from '../utils/hierarchy';
import { findActiveBrain } from '../utils/anatomy';
import { getPartStatus, PartStatus } from '../utils/anatomyStatus';
import {
  canItemBePickedUp,
  canItemBeEquippedToArea,
  canItemBeHeldInSlot,
} from '../utils/itemValidation';
import RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../core/EventBus';
import { LOGIC_CONFIG } from '../../ai/config';

export class InteractionSystem {
  public static requestPickup(world: World, entityId: EntityId, targetItemId: EntityId): boolean {
    const health = world.getComponent(entityId, 'health');
    if (!health || !health.isAlive) return false;

    if (world.getComponent(entityId, 'interactionAction')) return false;
    if (world.getComponent(entityId, 'pickupIntent')) return false;

    const pickupCheck = canItemBePickedUp(world, targetItemId);
    if (!pickupCheck.valid) return false;

    world.addComponent(entityId, 'pickupIntent', { targetItemId });
    return true;
  }

  public requestPickup(world: World, entityId: EntityId, targetItemId: EntityId): boolean {
    return InteractionSystem.requestPickup(world, entityId, targetItemId);
  }

  public static requestEquip(
    world: World,
    entityId: EntityId,
    slotIndex: number, // global slot index
    areaId: string,
    containerId?: EntityId
  ): boolean {
    const health = world.getComponent(entityId, 'health');
    if (!health || !health.isAlive) return false;
    if (world.getComponent(entityId, 'interactionAction')) return false;

    const aggSlots = getAggregatedInteractionSlots(world, entityId);
    const slotInfo = aggSlots[slotIndex];
    if (!slotInfo || slotInfo.isBroken || !slotInfo.slot.itemId) return false;

    const targetContainerId = containerId ?? entityId;
    const equipCheck = canItemBeEquippedToArea(
      world,
      slotInfo.slot.itemId,
      targetContainerId,
      areaId
    );
    if (!equipCheck.valid) return false;

    const item = world.getComponent(slotInfo.slot.itemId, 'item');

    world.addComponent(entityId, 'interactionAction', {
      type: 'equip',
      slotIndex: slotInfo.localSlotIndex,
      partId: slotInfo.partId,
      areaId,
      containerId: targetContainerId,
      timer: GAMEPLAY_CONFIG.pickupReachDuration * (item?.equipTimeMultiplier || 1.0),
      totalDuration: GAMEPLAY_CONFIG.pickupReachDuration * (item?.equipTimeMultiplier || 1.0),
    });

    return true;
  }

  public static requestUnequip(
    world: World,
    entityId: EntityId,
    slotIndex: number, // global slot index
    areaId: string,
    targetItemId: EntityId,
    containerId?: EntityId
  ): boolean {
    const health = world.getComponent(entityId, 'health');
    if (!health || !health.isAlive) return false;
    if (world.getComponent(entityId, 'interactionAction')) return false;

    const aggSlots = getAggregatedInteractionSlots(world, entityId);
    const slotInfo = aggSlots[slotIndex];
    if (!slotInfo || slotInfo.isBroken || slotInfo.slot.itemId !== null) return false;

    const targetContainerId = containerId ?? entityId;
    const containerEquip = world.getComponent(targetContainerId, 'equip');
    const area = containerEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (!area || !area.itemIds.includes(targetItemId)) return false;

    const slotCheck = canItemBeHeldInSlot(
      world,
      targetItemId,
      slotInfo.slot.strength,
      slotInfo.partId
    );
    if (!slotCheck.valid) return false;

    const item = world.getComponent(targetItemId, 'item');

    world.addComponent(entityId, 'interactionAction', {
      type: 'unequip',
      slotIndex: slotInfo.localSlotIndex,
      partId: slotInfo.partId,
      areaId,
      targetId: targetItemId,
      containerId: targetContainerId,
      timer: GAMEPLAY_CONFIG.pickupReachDuration * (item?.equipTimeMultiplier || 1.0),
      totalDuration: GAMEPLAY_CONFIG.pickupReachDuration * (item?.equipTimeMultiplier || 1.0),
    });

    return true;
  }

  private processPickupIntents(world: World): void {
    const intents = world.getEntitiesWith('pickupIntent', 'transform', 'health');

    for (const [id, { pickupIntent, transform, health }] of intents) {
      world.removeComponent(id, 'pickupIntent');

      if (!health.isAlive) continue;
      if (world.getComponent(id, 'interactionAction')) continue;

      const targetItemId = pickupIntent.targetItemId;
      const targetTransform = world.getComponent(targetItemId, 'transform');
      const targetItem = world.getComponent(targetItemId, 'item');
      const targetPhysStats = world.getComponent(targetItemId, 'physicsStats');
      const targetOwnership = world.getComponent(targetItemId, 'ownership');

      if (!targetTransform || !targetItem || !targetPhysStats || targetOwnership) {
        continue;
      }

      let isTargetAlreadyTargeted = false;
      const activeInteractions = world.getEntitiesWith('interactionAction');
      for (const [, { interactionAction }] of activeInteractions) {
        if (
          interactionAction.type === 'pickup' &&
          interactionAction.targetId === targetItemId &&
          interactionAction.phase !== 'abort_reach' &&
          interactionAction.phase !== 'abort_lift'
        ) {
          isTargetAlreadyTargeted = true;
          break;
        }
      }
      if (isTargetAlreadyTargeted) continue;

      const dist = Math.hypot(targetTransform.x - transform.x, targetTransform.z - transform.z);
      const myRadius = world.getComponent(id, 'physicsStats')?.radius.current ?? 0.4;
      const targetRadius = targetPhysStats.radius.current;
      const distBetweenBorders = Math.max(0, dist - myRadius - targetRadius);

      const aggSlots = getAggregatedInteractionSlots(world, id);
      let bestSlotInfo: AggregatedSlot | null = null;
      let maxStrength = -Infinity;

      for (const info of aggSlots) {
        if (
          !info.isBroken &&
          info.slot.itemId === null &&
          distBetweenBorders <= info.slot.interactDist
        ) {
          if (info.slot.strength > maxStrength) {
            maxStrength = info.slot.strength;
            bestSlotInfo = info;
          }
        }
      }

      if (!bestSlotInfo) {
        continue;
      }

      world.addComponent(id, 'interactionAction', {
        type: 'pickup',
        phase: 'reach',
        targetId: targetItemId,
        slotIndex: bestSlotInfo.localSlotIndex,
        partId: bestSlotInfo.partId,
        slotKind: bestSlotInfo.slot.slotKind ?? 'left_hand',
        targetItemPos: { x: targetTransform.x, y: targetTransform.y, z: targetTransform.z },
        timer: GAMEPLAY_CONFIG.pickupReachDuration,
        totalDuration: GAMEPLAY_CONFIG.pickupReachDuration,
        elapsedInReach: 0,
      });
    }
  }

  public cancelInteraction(world: World, physics: PhysicsSystem, entityId: EntityId): boolean {
    const action = world.getComponent(entityId, 'interactionAction');
    if (!action) return false;

    if (action.type === 'pickup') {
      if (action.phase === 'reach') {
        const currentRatio = Math.min(
          1,
          Math.max(0, 1 - action.timer / (action.totalDuration || 1))
        );
        const rollbackDuration = Math.max(0.01, action.elapsedInReach ?? 0);
        action.phase = 'abort_reach';
        action.abortStartProgress = currentRatio;
        action.timer = rollbackDuration;
        action.totalDuration = rollbackDuration;
        action.wantsCancel = false;
        return true;
      }

      if (action.phase === 'lift') {
        const currentRatio = Math.min(1, Math.max(0, action.timer / (action.totalDuration || 1)));
        const targetId = action.targetId;
        const transform = world.getComponent(entityId, 'transform');

        if (action.partId && targetId) {
          const slotsComp = world.getComponent(action.partId, 'interactionSlots');
          if (slotsComp && slotsComp.itemId === targetId) {
            slotsComp.itemId = null;
          }
        }

        EventBus.emit('inventory:updated');

        if (targetId && transform) {
          world.removeComponent(targetId, 'ownership');

          let dropX = action.targetItemPos?.x ?? transform.x;
          let dropY = action.targetItemPos?.y ?? transform.y;
          let dropZ = action.targetItemPos?.z ?? transform.z;

          if (action.relativeDist !== undefined && action.relativeAngle !== undefined) {
            const currentAngle = transform.angle + action.relativeAngle;
            dropX = transform.x + Math.cos(currentAngle) * action.relativeDist;
            dropZ = transform.z + Math.sin(currentAngle) * action.relativeDist;
          }

          const itTransform = world.getComponent(targetId, 'transform');
          if (itTransform) {
            itTransform.x = dropX;
            itTransform.y = dropY;
            itTransform.z = dropZ;
            itTransform.isDirty = true;
          }

          const renderable = world.getComponent(targetId, 'renderable');
          if (renderable) {
            renderable.isVisible = true;
          }

          const physStats = world.getComponent(targetId, 'physicsStats');
          if (physStats && physics.driver && physics.driver.isReady) {
            const radius = physStats.radius.current ?? 0.3;
            const weight = physStats.weight.current ?? 1;
            const mask = physStats.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

            const rawBody = physics.driver.createDynamicBody(
              { x: dropX, y: dropY + 0.5, z: dropZ },
              targetId
            );
            const rawCollider = physics.driver.createBallCollider(radius, rawBody, weight);
            rawCollider.setRestitution(0.3);

            world.addComponent(targetId, 'physicsBody', {
              rawBody,
              rawCollider,
              bodyType: 'dynamic',
              isStatic: false,
              category: CollisionCategory.ITEM,
              mask,
            });
          }
        }

        const remainingTime = action.timer;
        const reachDuration = GAMEPLAY_CONFIG.pickupReachDuration;
        const totalLiftDuration = action.totalDuration > 0 ? action.totalDuration : 1;
        const abortDuration = Math.max(0.01, remainingTime * (reachDuration / totalLiftDuration));

        action.phase = 'abort_lift';
        action.abortStartProgress = currentRatio;
        action.timer = abortDuration;
        action.totalDuration = abortDuration;
        action.wantsCancel = false;
        return true;
      }

      if (action.phase === 'abort_reach' || action.phase === 'abort_lift') {
        return false;
      }
    } else if (action.type === 'drop') {
      if (action.phase === 'drop_prep') {
        const elapsed = Math.max(0.01, action.totalDuration - action.timer);
        action.phase = 'abort_drop';
        action.timer = elapsed;
        action.totalDuration = elapsed;
        action.wantsCancel = false;
        return true;
      }
      if (action.phase === 'abort_drop' || action.phase === 'drop_recovery') {
        return false;
      }
    } else if (action.type === 'throw') {
      // В первой фазе поворота откат анимации не нужен — мгновенно отдаем контроль
      if (action.phase === 'throw_turn') {
        world.removeComponent(entityId, 'interactionAction');
        return true;
      }
      if (action.phase === 'throw_prep') {
        const elapsed = Math.max(0.01, action.totalDuration - action.timer);
        action.phase = 'abort_throw';
        action.timer = elapsed;
        action.totalDuration = elapsed;
        action.wantsCancel = false;
        return true;
      }
      if (action.phase === 'abort_throw' || action.phase === 'throw_recovery') {
        return false;
      }
    }

    world.removeComponent(entityId, 'interactionAction');
    return true;
  }

  private processDropIntents(world: World, physics: PhysicsSystem): void {
    const intents = world.getEntitiesWith('dropItemIntent', 'health');

    for (const [id, { dropItemIntent, health }] of intents) {
      world.removeComponent(id, 'dropItemIntent');

      if (!health.isAlive) continue;
      this.dropItem(world, physics, id, dropItemIntent.slotIndex);
    }
  }

  private processThrowIntents(world: World): void {
    const intents = world.getEntitiesWith('throwItemIntent', 'health', 'transform');

    for (const [id, { throwItemIntent, health, transform }] of intents) {
      world.removeComponent(id, 'throwItemIntent');

      if (!health.isAlive) continue;
      if (world.getComponent(id, 'interactionAction')) continue;

      const aggSlots = getAggregatedInteractionSlots(world, id);
      const slotInfo = aggSlots[throwItemIntent.slotIndex];
      if (!slotInfo || !slotInfo.slot.itemId) continue;

      const meta = world.getComponent(id, 'meta');
      const input = world.getComponent(id, 'input');

      // Бросок разрешен в стойках standing и crouching. Если лежит — переводим в присед
      if (meta?.stance === 'prone' || meta?.stance?.includes('prone')) {
        if (input) input.desiredStance = 'crouching';
        continue;
      }
      if (meta?.stance === 'airborne' || meta?.stance === 'sliding') {
        continue;
      }

      world.addComponent(id, 'interactionAction', {
        type: 'throw',
        phase: 'throw_turn',
        slotIndex: slotInfo.localSlotIndex,
        partId: slotInfo.partId,
        slotKind: slotInfo.slot.slotKind ?? 'left_hand',
        targetItemPos: throwItemIntent.targetPos,
        timer: 0,
        totalDuration: 0,
      });
    }
  }

  public update(dt: number, world: World, physics: PhysicsSystem): void {
    this.processPickupIntents(world);
    this.processDropIntents(world, physics);
    this.processThrowIntents(world);

    const entities = world.getEntitiesWith('interactionAction', 'transform', 'health');

    for (const [id, { interactionAction, transform, health }] of entities) {
      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      const localDt = dt * ts;

      if (!health.isAlive) {
        if (interactionAction.type === 'pickup' && interactionAction.phase === 'lift') {
          this.cancelInteraction(world, physics, id);
        }
        world.removeComponent(id, 'interactionAction');
        continue;
      }

      if (interactionAction.wantsCancel) {
        this.cancelInteraction(world, physics, id);
        continue;
      }

      if (interactionAction.type === 'drop') {
        if (interactionAction.phase === 'drop_prep') {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            if (interactionAction.partId) {
              this.executePhysicalDrop(world, physics, id, interactionAction.partId);
            }
            const movementStats = world.getComponent(id, 'movementStats');
            const recTime = movementStats?.dropRecoveryTime?.current ?? 0.1;

            interactionAction.phase = 'drop_recovery';
            interactionAction.timer = recTime;
            interactionAction.totalDuration = recTime;
          }
        } else if (
          interactionAction.phase === 'drop_recovery' ||
          interactionAction.phase === 'abort_drop'
        ) {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        }
        continue;
      }

      if (interactionAction.type === 'throw') {
        if (interactionAction.phase === 'throw_turn') {
          // Проверяем достижение требуемого угла поворота (до 15 градусов)
          if (interactionAction.targetItemPos) {
            const dx = interactionAction.targetItemPos.x - transform.x;
            const dz = interactionAction.targetItemPos.z - transform.z;
            const targetAngle = Math.atan2(dz, dx);
            let diff = Math.abs(
              Math.atan2(
                Math.sin(targetAngle - transform.angle),
                Math.cos(targetAngle - transform.angle)
              )
            );

            const tolerance = LOGIC_CONFIG.throwTurnTolerance ?? Math.PI / 12;

            if (diff <= tolerance) {
              const movementStats = world.getComponent(id, 'movementStats');
              const prepTime = movementStats?.throwPrepTime?.current ?? 0.25;

              interactionAction.phase = 'throw_prep';
              interactionAction.timer = prepTime;
              interactionAction.totalDuration = prepTime;
            }
          }
        } else if (interactionAction.phase === 'throw_prep') {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            if (interactionAction.partId && interactionAction.targetItemPos) {
              this.executePhysicalThrow(
                world,
                physics,
                id,
                interactionAction.partId,
                interactionAction.targetItemPos
              );
            }
            const movementStats = world.getComponent(id, 'movementStats');
            const recTime = movementStats?.throwRecoveryTime?.current ?? 0.2;

            interactionAction.phase = 'throw_recovery';
            interactionAction.timer = recTime;
            interactionAction.totalDuration = recTime;
          }
        } else if (
          interactionAction.phase === 'throw_recovery' ||
          interactionAction.phase === 'abort_throw'
        ) {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        }
        continue;
      }
      if (interactionAction.type === 'pickup') {
        if (interactionAction.phase === 'reach') {
          interactionAction.elapsedInReach = (interactionAction.elapsedInReach ?? 0) + localDt;
          interactionAction.timer -= localDt;

          if (interactionAction.timer <= 0) {
            const targetId = interactionAction.targetId;
            const slot = interactionAction.partId
              ? world.getComponent(interactionAction.partId, 'interactionSlots')
              : undefined;
            const targetEntity = targetId ? world.getEntity(targetId) : undefined;
            const targetItem = targetId ? world.getComponent(targetId, 'item') : undefined;
            const targetPhysStats = targetId
              ? world.getComponent(targetId, 'physicsStats')
              : undefined;
            const targetOwnership = targetId
              ? world.getComponent(targetId, 'ownership')
              : undefined;

            const partStatus = interactionAction.partId
              ? getPartStatus(world, interactionAction.partId)
              : PartStatus.INTACT;

            if (
              partStatus !== PartStatus.INTACT ||
              !targetId ||
              !targetEntity ||
              !slot ||
              !targetItem ||
              !targetPhysStats ||
              targetOwnership ||
              slot.itemId !== null
            ) {
              const currentRatio = Math.min(
                1,
                Math.max(0, 1 - interactionAction.timer / (interactionAction.totalDuration || 1))
              );
              const rollbackDuration = Math.max(
                0.01,
                interactionAction.elapsedInReach ?? GAMEPLAY_CONFIG.pickupReachDuration
              );
              interactionAction.phase = 'abort_reach';
              interactionAction.abortStartProgress = currentRatio;
              interactionAction.timer = rollbackDuration;
              interactionAction.totalDuration = rollbackDuration;
              continue;
            }

            const targetTransform = world.getComponent(targetId, 'transform');
            const myRadius = world.getComponent(id, 'physicsStats')?.radius.current ?? 0.4;
            const targetRadius = targetPhysStats.radius.current ?? 0.3;

            let isOutOfReach = false;
            if (targetTransform) {
              const currentDist = Math.hypot(
                targetTransform.x - transform.x,
                targetTransform.z - transform.z
              );
              const distBetweenBorders = Math.max(0, currentDist - myRadius - targetRadius);
              if (distBetweenBorders > slot.interactDist) {
                isOutOfReach = true;
              }
            } else {
              isOutOfReach = true;
            }

            const holdCheck = canItemBeHeldInSlot(
              world,
              targetId,
              slot.strength,
              interactionAction.partId
            );
            if (isOutOfReach || !holdCheck.valid) {
              const currentRatio = Math.min(
                1,
                Math.max(0, 1 - interactionAction.timer / (interactionAction.totalDuration || 1))
              );
              const rollbackDuration = Math.max(
                0.01,
                interactionAction.elapsedInReach ?? GAMEPLAY_CONFIG.pickupReachDuration
              );
              interactionAction.phase = 'abort_reach';
              interactionAction.abortStartProgress = currentRatio;
              interactionAction.timer = rollbackDuration;
              interactionAction.totalDuration = rollbackDuration;
              continue;
            }

            const targetTransformEntity = world.getComponent(targetId, 'transform');
            const selfTransform = world.getComponent(id, 'transform');
            let relativeDist = 0;
            let relativeAngle = 0 as Radians;
            if (targetTransformEntity && selfTransform) {
              const dx = targetTransformEntity.x - selfTransform.x;
              const dz = targetTransformEntity.z - selfTransform.z;
              relativeDist = Math.hypot(dx, dz);
              const worldAngle = Math.atan2(dz, dx);
              let relAngle = worldAngle - selfTransform.angle;
              relAngle = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
              relativeAngle = relAngle as Radians;
            }

            slot.itemId = targetId;
            const ownerPartId = interactionAction.partId || id;
            world.addComponent(targetId, 'ownership', { ownerId: ownerPartId, status: 'equipped' });
            world.removeComponent(targetId, 'thrownObject');
            EventBus.emit('inventory:updated');

            const physBody = world.getComponent(targetId, 'physicsBody');
            if (physBody && physBody.rawBody) {
              physics.driver?.removeRigidBody(physBody.rawBody);
              world.removeComponent(targetId, 'physicsBody');
            }
            const renderable = world.getComponent(targetId, 'renderable');
            if (renderable) {
              renderable.isVisible = false;
            }

            const totalWeight = calculateTotalEntityWeight(world, targetId);
            const minTime = Math.max(
              GAMEPLAY_CONFIG.pickupReachDuration,
              GAMEPLAY_CONFIG.minInteractionTime
            );
            const maxTime = Math.max(minTime, GAMEPLAY_CONFIG.maxInteractionTime);
            const maxCapacity = Math.max(1, slot.strength * 2);
            const weightRatio = Math.min(1, Math.max(0, totalWeight / maxCapacity));
            const stage2Duration = minTime + weightRatio * (maxTime - minTime);

            interactionAction.phase = 'lift';
            interactionAction.timer = stage2Duration;
            interactionAction.totalDuration = stage2Duration;
            interactionAction.relativeDist = relativeDist;
            interactionAction.relativeAngle = relativeAngle;
          }
        } else if (interactionAction.phase === 'lift') {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        } else if (
          interactionAction.phase === 'abort_reach' ||
          interactionAction.phase === 'abort_lift'
        ) {
          interactionAction.timer -= localDt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        }
        continue;
      }

      interactionAction.timer -= localDt;

      if (interactionAction.timer <= 0) {
        if (
          interactionAction.type === 'equip' &&
          interactionAction.partId &&
          interactionAction.areaId
        ) {
          const slot = world.getComponent(interactionAction.partId, 'interactionSlots');
          const containerId = interactionAction.containerId ?? id;
          const containerEquip = world.getComponent(containerId, 'equip');
          const area = containerEquip?.equipmentAreas.find(
            (a) => a.id === interactionAction.areaId
          );

          if (slot && slot.itemId) {
            const itemId = slot.itemId;
            const equipCheck = canItemBeEquippedToArea(
              world,
              itemId,
              containerId,
              interactionAction.areaId
            );

            if (equipCheck.valid && area) {
              area.itemIds.push(itemId);
              slot.itemId = null;
              world.addComponent(itemId, 'ownership', {
                ownerId: containerId,
                status: 'equipped',
              });
              EventBus.emit('inventory:updated');
            }
          }
        } else if (
          interactionAction.type === 'unequip' &&
          interactionAction.partId &&
          interactionAction.areaId &&
          interactionAction.targetId
        ) {
          const slot = world.getComponent(interactionAction.partId, 'interactionSlots');
          const containerId = interactionAction.containerId ?? id;
          const containerEquip = world.getComponent(containerId, 'equip');
          const area = containerEquip?.equipmentAreas.find(
            (a) => a.id === interactionAction.areaId
          );

          if (slot && slot.itemId === null && area) {
            const itemIdx = area.itemIds.indexOf(interactionAction.targetId);
            if (itemIdx !== -1) {
              const holdCheck = canItemBeHeldInSlot(
                world,
                interactionAction.targetId,
                slot.strength,
                interactionAction.partId
              );

              if (holdCheck.valid) {
                area.itemIds.splice(itemIdx, 1);
                slot.itemId = interactionAction.targetId;
                const ownerPartId = interactionAction.partId || id;
                world.addComponent(interactionAction.targetId, 'ownership', {
                  ownerId: ownerPartId,
                  status: 'equipped',
                });
                EventBus.emit('inventory:updated');
              }
            }
          }
        }

        world.removeComponent(id, 'interactionAction');
      }
    }
  }

  public dropItem(
    world: World,
    physics: PhysicsSystem,
    entityId: EntityId,
    globalSlotIndex: number
  ): void {
    const aggSlots = getAggregatedInteractionSlots(world, entityId);
    const slotInfo = aggSlots[globalSlotIndex];
    if (!slotInfo || !slotInfo.slot.itemId) return;

    if (world.getComponent(entityId, 'interactionAction')) return;

    const movementStats = world.getComponent(entityId, 'movementStats');
    const prepTime = movementStats?.dropPrepTime?.current ?? 0.1;

    world.addComponent(entityId, 'interactionAction', {
      type: 'drop',
      phase: 'drop_prep',
      slotIndex: slotInfo.localSlotIndex,
      partId: slotInfo.partId,
      slotKind: slotInfo.slot.slotKind ?? 'left_hand',
      timer: prepTime,
      totalDuration: prepTime,
    });
  }

  private executePhysicalDrop(
    world: World,
    physics: PhysicsSystem,
    entityId: EntityId,
    partId: EntityId
  ): void {
    const slot = world.getComponent(partId, 'interactionSlots');
    const transform = world.getComponent(entityId, 'transform');
    if (!slot || !slot.itemId || !transform) return;

    const itemId = slot.itemId;
    slot.itemId = null;

    world.removeComponent(itemId, 'ownership');
    EventBus.emit('inventory:updated');

    const renderable = world.getComponent(itemId, 'renderable');
    if (renderable) {
      renderable.isVisible = true;
    }

    const itemTransform = world.getComponent(itemId, 'transform');
    const physStats = world.getComponent(itemId, 'physicsStats');

    if (itemTransform && physStats) {
      const itemRadius = physStats.radius.current ?? 0.3;
      const creatureRadius = world.getComponent(entityId, 'physicsStats')?.radius.current ?? 0.4;

      const defaultDropOffset = creatureRadius + itemRadius + 0.05;

      const currentStance = world.getComponent(entityId, 'meta')?.stance || 'standing';
      let creatureHeight = 1.8;
      if (currentStance.includes('crouch')) creatureHeight = 1.2;
      else if (currentStance.includes('prone')) creatureHeight = 0.4;

      const comY = transform.y + creatureHeight / 2;
      const dropY = Math.max(transform.y + itemRadius, comY);

      const dir = { x: Math.cos(transform.angle), y: 0, z: Math.sin(transform.angle) };

      let dropOffset = defaultDropOffset;
      let isConstrainedByObstacle = false;

      // Трассировка луча: проверка наличия препятствий на пути броска
      if (physics.driver && physics.driver.isReady) {
        const rayStart = { x: transform.x, y: dropY, z: transform.z };
        const hits = physics.driver.castRayMultiple(
          rayStart,
          dir,
          defaultDropOffset,
          true,
          entityId
        );

        for (const hit of hits) {
          const hitTag = world.getComponent(hit.entityId, 'tag');
          const hitMeta = world.getComponent(hit.entityId, 'meta');
          const hitArch = hitTag?.archetype ?? hitMeta?.entityType;
          const hitPhysStats = world.getComponent(hit.entityId, 'physicsStats');

          if (hitArch === 'obstacle' && hitPhysStats?.isSolid !== false) {
            // Препятствие обнаружено ближе стандартной дистанции выноса
            const L = hit.toi;
            dropOffset = L - (itemRadius + 0.05);
            isConstrainedByObstacle = true;
            break;
          }
        }
      }

      const endX = transform.x + dir.x * dropOffset;
      const endZ = transform.z + dir.z * dropOffset;

      itemTransform.x = endX;
      itemTransform.y = dropY;
      itemTransform.z = endZ;
      itemTransform.isDirty = false;

      const mask = physStats.isSolid
        ? CollisionCategory.OBSTACLE |
          CollisionCategory.CREATURE |
          CollisionCategory.ITEM |
          CollisionCategory.PROJECTILE |
          CollisionCategory.TRIGGER_ZONE |
          CollisionCategory.PARTICLE
        : 0;

      let rawBody: RAPIER.RigidBody | undefined;
      let rawCollider: RAPIER.Collider | undefined;

      if (physics.driver && physics.driver.isReady) {
        rawBody = physics.driver.createDynamicBody({ x: endX, y: dropY, z: endZ }, itemId);
        const size = itemRadius * 0.8;
        const weight = physStats.weight.current ?? 1;
        rawCollider = physics.driver.createCuboidCollider(
          size / 2,
          size / 2,
          size / 2,
          rawBody,
          weight
        );
        rawCollider.setRestitution(0.3);
        rawBody.setLinearDamping(0.95);
        rawBody.setAngularDamping(0.95);

        // Прикладываем горизонтальный импульс броска только в свободном пространстве
        if (!isConstrainedByObstacle) {
          const targetVelocity = 0.5;
          const impulseMag = weight * targetVelocity;
          rawBody.applyImpulse({ x: dir.x * impulseMag, y: 0, z: dir.z * impulseMag }, true);
        }
      }

      world.addComponent(itemId, 'physicsBody', {
        rawBody,
        rawCollider,
        bodyType: 'dynamic',
        isStatic: false,
        category: CollisionCategory.ITEM,
        mask,
      });
    }
  }

  private executePhysicalThrow(
    world: World,
    physics: PhysicsSystem,
    entityId: EntityId,
    partId: EntityId,
    targetPos: import('../../types').Vec3
  ): void {
    const slot = world.getComponent(partId, 'interactionSlots');
    const transform = world.getComponent(entityId, 'transform');
    if (!slot || !slot.itemId || !transform) return;

    const itemId = slot.itemId;
    slot.itemId = null;

    world.removeComponent(itemId, 'ownership');
    EventBus.emit('inventory:updated');

    const renderable = world.getComponent(itemId, 'renderable');
    if (renderable) {
      renderable.isVisible = true;
    }

    const itemTransform = world.getComponent(itemId, 'transform');
    const physStats = world.getComponent(itemId, 'physicsStats');

    if (itemTransform && physStats) {
      const itemRadius = physStats.radius.current ?? 0.3;
      const creatureRadius = world.getComponent(entityId, 'physicsStats')?.radius.current ?? 0.4;
      const defaultDropOffset = creatureRadius + itemRadius + 0.05;

      const currentStance = world.getComponent(entityId, 'meta')?.stance || 'standing';
      let creatureHeight = 1.8;
      if (currentStance.includes('crouch')) creatureHeight = 1.2;
      else if (currentStance.includes('prone')) creatureHeight = 0.4;

      const comY = transform.y + creatureHeight * 0.65;
      const spawnY = Math.max(transform.y + itemRadius, comY);

      const dir = { x: Math.cos(transform.angle), y: 0, z: Math.sin(transform.angle) };

      let spawnOffset = defaultDropOffset;
      let isConstrainedByObstacle = false;

      // Проверка препятствия непосредственно перед носом персонажа
      if (physics.driver && physics.driver.isReady) {
        const rayStart = { x: transform.x, y: spawnY, z: transform.z };
        const hits = physics.driver.castRayMultiple(
          rayStart,
          dir,
          defaultDropOffset,
          true,
          entityId
        );

        for (const hit of hits) {
          const hitTag = world.getComponent(hit.entityId, 'tag');
          const hitMeta = world.getComponent(hit.entityId, 'meta');
          const hitArch = hitTag?.archetype ?? hitMeta?.entityType;
          const hitPhysStats = world.getComponent(hit.entityId, 'physicsStats');

          if (hitArch === 'obstacle' && hitPhysStats?.isSolid !== false) {
            const L = hit.toi;
            spawnOffset = L - (itemRadius + 0.05);
            isConstrainedByObstacle = true;
            break;
          }
        }
      }

      const endX = transform.x + dir.x * spawnOffset;
      const endZ = transform.z + dir.z * spawnOffset;

      itemTransform.x = endX;
      itemTransform.y = spawnY;
      itemTransform.z = endZ;
      // ВАЖНО: не выставляем isDirty = true, иначе syncDirtyTransforms обнулит скорость броска в setLinvel(0,0,0)
      itemTransform.isDirty = false;

      const mask = physStats.isSolid
        ? CollisionCategory.OBSTACLE |
          CollisionCategory.CREATURE |
          CollisionCategory.ITEM |
          CollisionCategory.PROJECTILE |
          CollisionCategory.TRIGGER_ZONE |
          CollisionCategory.PARTICLE
        : 0;

      let rawBody: RAPIER.RigidBody | undefined;
      let rawCollider: RAPIER.Collider | undefined;

      if (physics.driver && physics.driver.isReady) {
        rawBody = physics.driver.createDynamicBody({ x: endX, y: spawnY, z: endZ }, itemId);
        const size = itemRadius * 0.8;
        const weight = physStats.weight.current ?? 1;
        rawCollider = physics.driver.createCuboidCollider(
          size / 2,
          size / 2,
          size / 2,
          rawBody,
          weight
        );
        rawCollider.setRestitution(0.3);
        rawBody.setLinearDamping(0.05); // Минимальное сопротивление воздуха для честной параболы
        rawBody.setAngularDamping(0.1);

        // Если в упор нет препятствия — передаем баллистическую скорость
        if (!isConstrainedByObstacle) {
          const startPos = { x: endX, y: spawnY, z: endZ };
          const strength = slot.strength ?? 15;
          const vel = calculateThrowVelocity(startPos, targetPos, strength, weight);

          // Задаем импульс массы (J = m * v) и пробуждаем тело в физическом мире
          rawBody.applyImpulse({ x: vel.x * weight, y: vel.y * weight, z: vel.z * weight }, true);
          rawBody.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
          rawBody.wakeUp();

          // Легкое случайное вращение предмета в полете
          rawBody.setAngvel(
            { x: (Math.random() - 0.5) * 4, y: 2.0, z: (Math.random() - 0.5) * 4 },
            true
          );
        }
      }

      world.addComponent(itemId, 'physicsBody', {
        rawBody,
        rawCollider,
        bodyType: 'dynamic',
        isStatic: false,
        category: CollisionCategory.ITEM,
        mask,
      });

      world.addComponent(itemId, 'thrownObject', {
        throwerId: entityId,
        timestamp: Date.now(),
        isAirborne: true,
      });
    }
  }
}
