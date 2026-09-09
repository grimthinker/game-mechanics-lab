import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, EntityId } from '../types';
import { Circle } from 'detect-collisions';

export class InteractionSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith('interactionAction', 'equip', 'transform', 'health');

    for (const [id, { interactionAction, equip, transform, health }] of entities) {
      if (!health.isAlive) {
        world.removeComponent(id, 'interactionAction');
        continue;
      }

      interactionAction.timer -= dt;

      if (interactionAction.timer <= 0) {
        if (
          interactionAction.type === 'pickup' &&
          interactionAction.targetId &&
          interactionAction.slotIndex !== undefined
        ) {
          const targetId = interactionAction.targetId;
          const targetTransform = world.getComponent(targetId, 'transform');
          const targetItem = world.getComponent(targetId, 'item');
          const targetPhysStats = world.getComponent(targetId, 'physicsStats');
          const slot = equip.interactionSlots[interactionAction.slotIndex];

          if (targetTransform && targetItem && slot && slot.itemId === null) {
            const dist = Math.hypot(
              targetTransform.x - transform.x,
              targetTransform.y - transform.y
            );
            const myRadius = world.getComponent(id, 'physicsStats')?.radius.current ?? 16;
            const targetRadius = targetPhysStats?.radius.current ?? 16;
            const distBetweenBorders = Math.max(0, dist - myRadius - targetRadius);

            if (distBetweenBorders <= slot.interactDist) {
              const weight = targetPhysStats?.weight.current ?? 1;
              if (weight <= slot.strength * 2) {
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
              }
            }
          }
        } else if (
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
