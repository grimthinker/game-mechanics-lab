import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, EntityId, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from '../types';
import { Circle } from 'detect-collisions';
import { GAMEPLAY_CONFIG } from '../../config/gameplayConfig';
import { Radians } from '../../utils';
import {
  calculateTotalEntityWeight,
  isDescendantOf,
  isItemEquippableToArea,
  getAggregatedInteractionSlots,
  AggregatedSlot,
} from '../utils/hierarchy';
import { findActiveBrain } from '../utils/anatomy';

export class InteractionSystem {
  public static requestPickup(world: World, entityId: EntityId, targetItemId: EntityId): boolean {
    const health = world.getComponent(entityId, 'health');
    if (!health || !health.isAlive) return false;

    if (world.getComponent(entityId, 'interactionAction')) return false;
    if (world.getComponent(entityId, 'pickupIntent')) return false;

    const targetOwnership = world.getComponent(targetItemId, 'ownership');
    const targetItem = world.getComponent(targetItemId, 'item');
    if (!targetItem || targetOwnership) return false;

    // Защита от поднятия в инвентарь или слоты предметов, которые обладают "мозгом"
    if (findActiveBrain(world, targetItemId)) return false;

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
    if (!slotInfo || !slotInfo.slot.itemId) return false;

    const targetContainerId = containerId ?? entityId;
    const containerEquip = world.getComponent(targetContainerId, 'equip');
    const area = containerEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (!area) return false;

    const item = world.getComponent(slotInfo.slot.itemId, 'item');
    if (!item || !isItemEquippableToArea(item, area.type)) return false;
    if (isDescendantOf(world, targetContainerId, slotInfo.slot.itemId)) return false;

    // Защита от помещения "живых" существ в экипировку
    if (findActiveBrain(world, slotInfo.slot.itemId)) return false;

    world.addComponent(entityId, 'interactionAction', {
      type: 'equip',
      slotIndex: slotInfo.localSlotIndex,
      partId: slotInfo.partId,
      areaId,
      containerId: targetContainerId,
      timer: GAMEPLAY_CONFIG.pickupReachDuration * (item.equipTimeMultiplier || 1.0),
      totalDuration: GAMEPLAY_CONFIG.pickupReachDuration * (item.equipTimeMultiplier || 1.0),
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
    if (!slotInfo || slotInfo.slot.itemId !== null) return false;

    const targetContainerId = containerId ?? entityId;
    const containerEquip = world.getComponent(targetContainerId, 'equip');
    const area = containerEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (!area || !area.itemIds.includes(targetItemId)) return false;

    const totalWeight = calculateTotalEntityWeight(world, targetItemId);
    if (totalWeight > slotInfo.slot.strength * 2) return false;

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

      const dist = Math.hypot(targetTransform.x - transform.x, targetTransform.y - transform.y);
      const myRadius = world.getComponent(id, 'physicsStats')?.radius.current ?? 16;
      const targetRadius = targetPhysStats.radius.current;
      const distBetweenBorders = Math.max(0, dist - myRadius - targetRadius);

      const aggSlots = getAggregatedInteractionSlots(world, id);
      let bestSlotInfo: AggregatedSlot | null = null;
      let maxStrength = -Infinity;

      for (const info of aggSlots) {
        if (info.slot.itemId === null && distBetweenBorders <= info.slot.interactDist) {
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
        targetItemPos: { x: targetTransform.x, y: targetTransform.y },
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

        if (targetId && transform) {
          world.removeComponent(targetId, 'ownership');

          let dropX = action.targetItemPos?.x ?? transform.x;
          let dropY = action.targetItemPos?.y ?? transform.y;

          if (action.relativeDist !== undefined && action.relativeAngle !== undefined) {
            const currentAngle = transform.angle + action.relativeAngle;
            dropX = transform.x + Math.cos(currentAngle) * action.relativeDist;
            dropY = transform.y + Math.sin(currentAngle) * action.relativeDist;
          }

          const itTransform = world.getComponent(targetId, 'transform');
          if (itTransform) {
            itTransform.x = dropX;
            itTransform.y = dropY;
          }

          const renderable = world.getComponent(targetId, 'renderable');
          if (renderable) {
            renderable.isVisible = true;
          }

          const physStats = world.getComponent(targetId, 'physicsStats');
          if (physStats) {
            const body = new Circle({ x: dropX, y: dropY }, physStats.radius.current);
            body.isStatic = false;
            const mask = physStats.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
            world.addComponent(targetId, 'physicsBody', {
              body,
              isStatic: false,
              category: CollisionCategory.ITEM,
              mask,
            });
            physics.registerBody(targetId, body);
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
    }

    world.removeComponent(entityId, 'interactionAction');
    return true;
  }

  public update(dt: number, world: World, physics: PhysicsSystem): void {
    this.processPickupIntents(world);

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

            if (
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
            const myRadius = world.getComponent(id, 'physicsStats')?.radius.current ?? 16;
            const targetRadius = targetPhysStats.radius.current;

            let isOutOfReach = false;
            if (targetTransform) {
              const currentDist = Math.hypot(
                targetTransform.x - transform.x,
                targetTransform.y - transform.y
              );
              const distBetweenBorders = Math.max(0, currentDist - myRadius - targetRadius);
              if (distBetweenBorders > slot.interactDist) {
                isOutOfReach = true;
              }
            } else {
              isOutOfReach = true;
            }

            const totalWeight = calculateTotalEntityWeight(world, targetId);
            if (isOutOfReach || totalWeight > slot.strength * 2) {
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
              const dy = targetTransformEntity.y - selfTransform.y;
              relativeDist = Math.hypot(dx, dy);
              const worldAngle = Math.atan2(dy, dx);
              let relAngle = worldAngle - selfTransform.angle;
              relAngle = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
              relativeAngle = relAngle as Radians;
            }

            slot.itemId = targetId;
            world.addComponent(targetId, 'ownership', { ownerId: id, status: 'equipped' });

            const physBody = world.getComponent(targetId, 'physicsBody');
            if (physBody) {
              physics.unregisterBody(physBody.body);
              world.removeComponent(targetId, 'physicsBody');
            }
            const renderable = world.getComponent(targetId, 'renderable');
            if (renderable) {
              renderable.isVisible = false;
            }

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

          if (slot && slot.itemId && area && containerEquip) {
            const itemId = slot.itemId;
            const item = world.getComponent(itemId, 'item');

            if (item && isItemEquippableToArea(item, area.type)) {
              if (!isDescendantOf(world, containerId, itemId)) {
                let currentSize = 0;
                for (const aItemId of area.itemIds) {
                  const aItem = world.getComponent(aItemId, 'item');
                  if (aItem) currentSize += aItem.size;
                }

                if (currentSize + item.size <= area.space) {
                  area.itemIds.push(itemId);
                  slot.itemId = null;
                  world.addComponent(itemId, 'ownership', {
                    ownerId: containerId,
                    status: 'equipped',
                  });
                }
              }
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
              const totalWeight = calculateTotalEntityWeight(world, interactionAction.targetId);

              if (totalWeight <= slot.strength * 2) {
                area.itemIds.splice(itemIdx, 1);
                slot.itemId = interactionAction.targetId;
                world.addComponent(interactionAction.targetId, 'ownership', {
                  ownerId: id,
                  status: 'equipped',
                });
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
    const transform = world.getComponent(entityId, 'transform');
    if (!slotInfo || !transform) return;

    const slot = slotInfo.slot;
    if (slot.itemId === null) return;

    const itemId = slot.itemId;
    slot.itemId = null;

    world.removeComponent(itemId, 'ownership');

    const renderable = world.getComponent(itemId, 'renderable');
    if (renderable) {
      renderable.isVisible = true;
    }

    const itemTransform = world.getComponent(itemId, 'transform');
    const physStats = world.getComponent(itemId, 'physicsStats');

    if (itemTransform && physStats) {
      const itemRadius = physStats.radius.current;
      const dropDist = slot.interactDist;

      const startPoint = { x: transform.x, y: transform.y };
      let endPoint = {
        x: transform.x + Math.cos(transform.angle) * dropDist,
        y: transform.y + Math.sin(transform.angle) * dropDist,
      };

      const disabledBodies: any[] = [];
      const dropperPhys = world.getComponent(entityId, 'physicsBody');

      // Временно убираем тело того, кто бросает предмет, чтобы луч не застрял в нем самом
      if (dropperPhys && dropperPhys.body) {
        physics.system.remove(dropperPhys.body);
        disabledBodies.push(dropperPhys.body);
      }

      try {
        while (true) {
          const rayResult = physics.system.raycast(startPoint, endPoint);
          if (!rayResult) break; // Путь чист

          const hitBody = rayResult.body;
          const hitEntityId = physics.getEntityByBody(hitBody);
          let blocksDrop = false;

          if (hitEntityId) {
            const hitPhys = world.getComponent(hitEntityId, 'physicsBody');
            const hitPhysStats = world.getComponent(hitEntityId, 'physicsStats');
            const hitHealth = world.getComponent(hitEntityId, 'health');

            const isTrigger = hitPhys?.isTrigger;
            const isDead = hitHealth && !hitHealth.isAlive;
            const isSolid = hitPhysStats?.isSolid ?? hitPhys?.mask !== 0;

            // Останавливаем луч только о живые существа, целые препятствия и предметы с коллизией
            if (!isTrigger && !isDead && isSolid) {
              blocksDrop = true;
            }
          } else {
            // Геометрия без EntityId (базовые границы)
            blocksDrop = true;
          }

          if (blocksDrop) {
            // Совместимость: rayResult.point или сам объект в разных версиях detect-collisions
            const hitPoint = (rayResult as any).point || rayResult;
            const hitDist = Math.hypot(hitPoint.x - startPoint.x, hitPoint.y - startPoint.y);

            // Укорачиваем дистанцию, чтобы предмет не врезался краем (минус радиус предмета и 1px зазора)
            const safeDist = Math.max(0, hitDist - itemRadius - 1);

            endPoint = {
              x: startPoint.x + Math.cos(transform.angle) * safeDist,
              y: startPoint.y + Math.sin(transform.angle) * safeDist,
            };
            break;
          } else {
            // Игнорируем мертвые тела и триггеры, временно отключая их и продолжая луч
            physics.system.remove(hitBody);
            disabledBodies.push(hitBody);
          }
        }
      } finally {
        // Гарантированно возвращаем все отключенные тела обратно в физический движок
        for (const b of disabledBodies) {
          physics.system.insert(b);
        }
      }

      itemTransform.x = endPoint.x;
      itemTransform.y = endPoint.y;

      const body = new Circle({ x: itemTransform.x, y: itemTransform.y }, itemRadius);
      body.isStatic = false;
      const mask = physStats.isSolid
        ? CollisionCategory.OBSTACLE |
          CollisionCategory.CREATURE |
          CollisionCategory.ITEM |
          CollisionCategory.PROJECTILE |
          CollisionCategory.TRIGGER_ZONE |
          CollisionCategory.PARTICLE
        : 0;

      world.addComponent(itemId, 'physicsBody', {
        body,
        isStatic: false,
        category: CollisionCategory.ITEM,
        mask,
      });
      physics.registerBody(itemId, body);
    }
  }
}
