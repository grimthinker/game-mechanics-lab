import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, EntityId, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from '../types';
import { Circle } from 'detect-collisions';
import { GAMEPLAY_CONFIG } from '../../gameplayConfig';

export class InteractionSystem {
  public static startPickup(world: World, entityId: EntityId, targetItemId: EntityId): boolean {
    const health = world.getComponent(entityId, 'health');
    if (!health || !health.isAlive) return false;

    if (world.getComponent(entityId, 'interactionAction')) return false;

    const equip = world.getComponent(entityId, 'equip');
    const transform = world.getComponent(entityId, 'transform');
    const targetTransform = world.getComponent(targetItemId, 'transform');
    const targetItem = world.getComponent(targetItemId, 'item');
    const targetPhysStats = world.getComponent(targetItemId, 'physicsStats');
    const targetOwnership = world.getComponent(targetItemId, 'ownership');

    if (
      !equip ||
      !transform ||
      !targetTransform ||
      !targetItem ||
      !targetPhysStats ||
      targetOwnership
    ) {
      return false;
    }

    const activeInteractions = world.getEntitiesWith('interactionAction');
    for (const [, { interactionAction }] of activeInteractions) {
      if (
        interactionAction.type === 'pickup' &&
        interactionAction.targetId === targetItemId &&
        interactionAction.phase !== 'abort_reach' &&
        interactionAction.phase !== 'abort_lift'
      ) {
        return false;
      }
    }

    const dist = Math.hypot(targetTransform.x - transform.x, targetTransform.y - transform.y);
    const myRadius = world.getComponent(entityId, 'physicsStats')?.radius.current ?? 16;
    const targetRadius = targetPhysStats.radius.current;
    const distBetweenBorders = Math.max(0, dist - myRadius - targetRadius);

    let bestSlotIndex = -1;
    let maxStrength = -Infinity;

    equip.interactionSlots.forEach((slot, index) => {
      if (slot.itemId === null && distBetweenBorders <= slot.interactDist) {
        if (slot.strength > maxStrength) {
          maxStrength = slot.strength;
          bestSlotIndex = index;
        }
      }
    });

    if (bestSlotIndex === -1) {
      return false;
    }

    world.addComponent(entityId, 'interactionAction', {
      type: 'pickup',
      phase: 'reach',
      targetId: targetItemId,
      slotIndex: bestSlotIndex,
      targetItemPos: { x: targetTransform.x, y: targetTransform.y },
      timer: GAMEPLAY_CONFIG.pickupReachDuration,
      totalDuration: GAMEPLAY_CONFIG.pickupReachDuration,
      elapsedInReach: 0,
    });

    return true;
  }

  public startPickup(world: World, entityId: EntityId, targetItemId: EntityId): boolean {
    return InteractionSystem.startPickup(world, entityId, targetItemId);
  }

  public cancelInteraction(world: World, physics: PhysicsSystem, entityId: EntityId): boolean {
    const action = world.getComponent(entityId, 'interactionAction');
    if (!action) return false;

    if (action.type === 'pickup') {
      if (action.phase === 'reach') {
        const rollbackDuration = Math.max(0.01, action.elapsedInReach ?? 0);
        action.phase = 'abort_reach';
        action.timer = rollbackDuration;
        action.totalDuration = rollbackDuration;
        action.wantsCancel = false;
        return true;
      }

      if (action.phase === 'lift') {
        const targetId = action.targetId;
        const equip = world.getComponent(entityId, 'equip');

        if (equip && action.slotIndex !== undefined && targetId) {
          if (equip.interactionSlots[action.slotIndex]?.itemId === targetId) {
            equip.interactionSlots[action.slotIndex].itemId = null;
          }
        }

        if (targetId && action.targetItemPos) {
          world.removeComponent(targetId, 'ownership');

          const itTransform = world.getComponent(targetId, 'transform');
          if (itTransform) {
            itTransform.x = action.targetItemPos.x;
            itTransform.y = action.targetItemPos.y;
          }

          const renderable = world.getComponent(targetId, 'renderable');
          if (renderable) {
            renderable.isVisible = true;
          }

          const physStats = world.getComponent(targetId, 'physicsStats');
          if (physStats) {
            const body = new Circle(
              { x: action.targetItemPos.x, y: action.targetItemPos.y },
              physStats.radius.current
            );
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

        const remainingTime = Math.max(0.01, action.timer);
        action.phase = 'abort_lift';
        action.timer = remainingTime;
        action.totalDuration = remainingTime;
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
    const entities = world.getEntitiesWith('interactionAction', 'equip', 'transform', 'health');

    for (const [id, { interactionAction, equip, transform, health }] of entities) {
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
          interactionAction.elapsedInReach = (interactionAction.elapsedInReach ?? 0) + dt;
          interactionAction.timer -= dt;

          if (interactionAction.timer <= 0) {
            const targetId = interactionAction.targetId;
            const slot =
              interactionAction.slotIndex !== undefined
                ? equip.interactionSlots[interactionAction.slotIndex]
                : undefined;
            const targetItem = targetId ? world.getComponent(targetId, 'item') : undefined;
            const targetPhysStats = targetId
              ? world.getComponent(targetId, 'physicsStats')
              : undefined;

            if (!targetId || !slot || !targetItem || !targetPhysStats || slot.itemId !== null) {
              world.removeComponent(id, 'interactionAction');
              continue;
            }

            const weight = targetPhysStats.weight.current;
            if (weight > slot.strength * 2) {
              const rollbackDuration = Math.max(
                0.01,
                interactionAction.elapsedInReach ?? GAMEPLAY_CONFIG.pickupReachDuration
              );
              interactionAction.phase = 'abort_reach';
              interactionAction.timer = rollbackDuration;
              interactionAction.totalDuration = rollbackDuration;
              continue;
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

            const maxCapacity = Math.max(1, slot.strength * 2);
            const weightRatio = Math.min(1, Math.max(0, weight / maxCapacity));
            const stage2Duration =
              GAMEPLAY_CONFIG.minInteractionTime +
              weightRatio *
                (GAMEPLAY_CONFIG.maxInteractionTime - GAMEPLAY_CONFIG.minInteractionTime);

            interactionAction.phase = 'lift';
            interactionAction.timer = stage2Duration;
            interactionAction.totalDuration = stage2Duration;
          }
        } else if (interactionAction.phase === 'lift') {
          interactionAction.timer -= dt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        } else if (
          interactionAction.phase === 'abort_reach' ||
          interactionAction.phase === 'abort_lift'
        ) {
          interactionAction.timer -= dt;
          if (interactionAction.timer <= 0) {
            world.removeComponent(id, 'interactionAction');
          }
        }
        continue;
      }

      interactionAction.timer -= dt;

      if (interactionAction.timer <= 0) {
        if (
          interactionAction.type === 'equip' &&
          interactionAction.slotIndex !== undefined &&
          interactionAction.areaId
        ) {
          const slot = equip.interactionSlots[interactionAction.slotIndex];
          const area = equip.equipmentAreas.find((a) => a.id === interactionAction.areaId);

          if (slot && slot.itemId && area) {
            const itemId = slot.itemId;
            const item = world.getComponent(itemId, 'item');

            if (item && item.equippable && item.equipType === area.type) {
              let currentSize = 0;
              for (const aItemId of area.itemIds) {
                const aItem = world.getComponent(aItemId, 'item');
                if (aItem) currentSize += aItem.size;
              }

              if (currentSize + item.size <= area.space) {
                area.itemIds.push(itemId);
                slot.itemId = null;
              }
            }
          }
        } else if (
          interactionAction.type === 'unequip' &&
          interactionAction.slotIndex !== undefined &&
          interactionAction.areaId &&
          interactionAction.targetId
        ) {
          const slot = equip.interactionSlots[interactionAction.slotIndex];
          const area = equip.equipmentAreas.find((a) => a.id === interactionAction.areaId);

          if (slot && slot.itemId === null && area) {
            const itemIdx = area.itemIds.indexOf(interactionAction.targetId);
            if (itemIdx !== -1) {
              const physStats = world.getComponent(interactionAction.targetId, 'physicsStats');
              const weight = physStats?.weight.current ?? 1;

              if (weight <= slot.strength * 2) {
                area.itemIds.splice(itemIdx, 1);
                slot.itemId = interactionAction.targetId;
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
    slotIndex: number
  ): void {
    const equip = world.getComponent(entityId, 'equip');
    const transform = world.getComponent(entityId, 'transform');
    if (!equip || !transform) return;

    const slot = equip.interactionSlots[slotIndex];
    if (!slot || slot.itemId === null) return;

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
      const dropDist = slot.interactDist;
      itemTransform.x = transform.x + Math.cos(transform.angle) * dropDist;
      itemTransform.y = transform.y + Math.sin(transform.angle) * dropDist;

      const body = new Circle({ x: itemTransform.x, y: itemTransform.y }, physStats.radius.current);
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
