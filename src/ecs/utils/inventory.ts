import { World } from '../World';
import { EntityId, InventoryComponent } from '../types';
import { getAllEquippedDescendants } from './hierarchy';

/**
 * Ищет контейнер с инвентарем (сумку/рюкзак), принадлежащий существу или объекту
 */
export function findEntityInventory(
  world: World,
  rootEntityId: EntityId
): { containerId: EntityId; inventory: InventoryComponent } | null {
  const directInv = world.getComponent(rootEntityId, 'inventory');
  if (directInv) {
    return { containerId: rootEntityId, inventory: directInv };
  }

  const descendants = getAllEquippedDescendants(world, rootEntityId);
  for (const descId of descendants) {
    const descInv = world.getComponent(descId, 'inventory');
    if (descInv) {
      return { containerId: descId, inventory: descInv };
    }
  }

  return null;
}

/**
 * Пытается уложить предмет в инвентарь контейнера:
 * 1. Сначала объединяет со стаками того же типа предмета (до maxStack).
 * 2. Остаток укладывает в первую свободную ячейку.
 * Возвращает true, если предмет полностью или частично удалось разместить.
 */
export function tryAddItemToInventory(
  world: World,
  inventoryContainerId: EntityId,
  incomingItemId: EntityId
): boolean {
  const inv = world.getComponent(inventoryContainerId, 'inventory');
  const incomingItem = world.getComponent(incomingItemId, 'item');
  if (!inv || !incomingItem || incomingItem.count <= 0) return false;

  // 1. Если предмет стакуется, объединяем с существующими неполными стаками
  if (incomingItem.maxStack > 1) {
    for (const row of inv.slots) {
      for (const cell of row) {
        if (cell.itemId && cell.itemId !== incomingItemId) {
          const existingItem = world.getComponent(cell.itemId, 'item');
          if (existingItem && existingItem.name === incomingItem.name) {
            const space = existingItem.maxStack - existingItem.count;
            if (space > 0) {
              const transfer = Math.min(space, incomingItem.count);
              existingItem.count += transfer;
              cell.count = existingItem.count;
              incomingItem.count -= transfer;

              if (incomingItem.count <= 0) {
                // Предмет полностью поглощен
                const phys = world.getComponent(incomingItemId, 'physicsBody');
                if (phys) world.removeComponent(incomingItemId, 'physicsBody');
                world.removeEntity(incomingItemId);
                return true;
              }
            }
          }
        }
      }
    }
  }

  // 2. Укладываем оставшееся количество в первую свободную ячейку
  if (incomingItem.count > 0) {
    for (const row of inv.slots) {
      for (const cell of row) {
        if (!cell.itemId) {
          cell.itemId = incomingItemId;
          cell.count = incomingItem.count;

          world.addComponent(incomingItemId, 'ownership', {
            ownerId: inventoryContainerId,
            status: 'inventory',
          });

          // Скрываем визуал и отключаем коллизию на полу
          const phys = world.getComponent(incomingItemId, 'physicsBody');
          if (phys) world.removeComponent(incomingItemId, 'physicsBody');

          const renderable = world.getComponent(incomingItemId, 'renderable');
          if (renderable) renderable.isVisible = false;

          return true;
        }
      }
    }
  }

  return false;
}
