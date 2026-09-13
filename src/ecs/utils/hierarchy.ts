import { World } from '../World';
import {
  EntityId,
  EquipmentArea,
  ItemData,
  OwnershipComponent,
  TagComponent,
  EquipmentComponent,
  InventoryComponent,
  PhysicsStatsComponent,
} from '../types';

/**
 * Поднимается вверх по цепочке владения (ownership.ownerId) и находит корневую сущность.
 * Если корень — существо (archetype: creature), возвращает его ID.
 */
export function getRootOwner(world: World, entityId: EntityId): EntityId | null {
  const visited = new Set<EntityId>();
  let current: EntityId | undefined = entityId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const tag: TagComponent | undefined = world.getComponent(current, 'tag');
    if (tag?.archetype === 'creature') {
      return current;
    }
    const ownership: OwnershipComponent | undefined = world.getComponent(current, 'ownership');
    if (!ownership || !ownership.ownerId) {
      return current;
    }
    current = ownership.ownerId;
  }

  return current ?? null;
}

/**
 * Проверяет, является ли potentialDescendantId потомком ancestorId (вложен внутрь по цепочке ownership).
 * Предотвращает циклические вложения контейнеров друг в друга.
 */
export function isDescendantOf(
  world: World,
  potentialDescendantId: EntityId,
  ancestorId: EntityId
): boolean {
  if (potentialDescendantId === ancestorId) return true;

  const visited = new Set<EntityId>();
  let current: EntityId | undefined = potentialDescendantId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const ownership: OwnershipComponent | undefined = world.getComponent(current, 'ownership');
    if (!ownership || !ownership.ownerId) return false;
    if (ownership.ownerId === ancestorId) return true;
    current = ownership.ownerId;
  }

  return false;
}

/**
 * Рекурсивно собирает все ID предметов, находящихся во всех областях экипировки сущности и её подуровней.
 */
export function getAllEquippedDescendants(world: World, rootEntityId: EntityId): EntityId[] {
  const result: EntityId[] = [];
  const visited = new Set<EntityId>();

  function traverse(entityId: EntityId) {
    if (visited.has(entityId)) return;
    visited.add(entityId);

    const equip = world.getComponent(entityId, 'equip');
    if (!equip || !equip.equipmentAreas) return;

    for (const area of equip.equipmentAreas) {
      for (const itemId of area.itemIds) {
        result.push(itemId);
        traverse(itemId);
      }
    }
  }

  traverse(rootEntityId);
  return result;
}

/**
 * Рекурсивно собирает все ID предметов, содержащихся в сущности (и в equip.equipmentAreas, и в inventory.slots).
 */
export function getAllContainedItems(world: World, rootEntityId: EntityId): EntityId[] {
  const result: EntityId[] = [];
  const visited = new Set<EntityId>();

  function traverse(entityId: EntityId) {
    if (visited.has(entityId)) return;
    visited.add(entityId);

    const equip = world.getComponent(entityId, 'equip');
    if (equip && equip.equipmentAreas) {
      for (const area of equip.equipmentAreas) {
        for (const itemId of area.itemIds) {
          result.push(itemId);
          traverse(itemId);
        }
      }
    }

    const inv = world.getComponent(entityId, 'inventory');
    if (inv && inv.slots) {
      for (const row of inv.slots) {
        for (const cell of row) {
          if (cell.itemId) {
            result.push(cell.itemId);
            traverse(cell.itemId);
          }
        }
      }
    }
  }

  traverse(rootEntityId);
  return result;
}

/**
 * Рекурсивно рассчитывает суммарный вес сущности с учетом собственного веса,
 * всех экипированных в неё предметов и всех предметов в инвентаре.
 */
export function calculateTotalEntityWeight(
  world: World,
  entityId: EntityId,
  visited = new Set<EntityId>()
): number {
  if (visited.has(entityId)) return 0;
  visited.add(entityId);

  const physStats: PhysicsStatsComponent | undefined = world.getComponent(entityId, 'physicsStats');
  let total = physStats?.weight.current ?? 1;

  const equip: EquipmentComponent | undefined = world.getComponent(entityId, 'equip');
  if (equip && equip.equipmentAreas) {
    for (const area of equip.equipmentAreas) {
      for (const itemId of area.itemIds) {
        total += calculateTotalEntityWeight(world, itemId, visited);
      }
    }
  }

  const inv: InventoryComponent | undefined = world.getComponent(entityId, 'inventory');
  if (inv && inv.slots) {
    for (const row of inv.slots) {
      for (const cell of row) {
        if (cell.itemId) {
          total += calculateTotalEntityWeight(world, cell.itemId, visited);
        }
      }
    }
  }

  return Math.round(total * 10) / 10;
}

/**
 * Проверяет, можно ли предмет поместить в область указанного типа.
 */
export function isItemEquippableToArea(item: ItemData, areaType: string): boolean {
  if (!item.equippable || !Array.isArray(item.equipTypes)) return false;
  return item.equipTypes.includes(areaType);
}

/**
 * Ищет область экипировки в дереве персонажа (на самом существе или на его экипированных предметах).
 */
export function findEquipmentAreaInHierarchy(
  world: World,
  rootEntityId: EntityId,
  areaId: string,
  preferredContainerId?: EntityId
): { containerId: EntityId; area: EquipmentArea } | null {
  if (preferredContainerId) {
    const containerEquip = world.getComponent(preferredContainerId, 'equip');
    const area = containerEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (area) {
      return { containerId: preferredContainerId, area };
    }
  }

  const rootEquip = world.getComponent(rootEntityId, 'equip');
  const rootArea = rootEquip?.equipmentAreas.find((a) => a.id === areaId);
  if (rootArea) {
    return { containerId: rootEntityId, area: rootArea };
  }

  const descendants = getAllEquippedDescendants(world, rootEntityId);
  for (const descId of descendants) {
    const descEquip = world.getComponent(descId, 'equip');
    const descArea = descEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (descArea) {
      return { containerId: descId, area: descArea };
    }
  }

  return null;
}
