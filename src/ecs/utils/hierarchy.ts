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
  InteractionSlot,
} from '../types';
import { traverseAnatomyGraph, findActiveBrain } from './anatomy';

import { getPartStatus, PartStatus } from './anatomyStatus';

export interface AggregatedSlot {
  partId: EntityId;
  localSlotIndex: number;
  globalSlotIndex: number;
  slot: InteractionSlot;
  isBroken: boolean;
}

/**
 * Возвращает все части тела, привязанные к абстрактному корню существа (или саму часть, если это предмет)
 */
export function getAnatomyParts(world: World, rootEntityId: EntityId): EntityId[] {
  if (world.getComponent(rootEntityId, 'socketDef')) {
    return traverseAnatomyGraph(world, rootEntityId).sort();
  }
  const assembly = world.getComponent(rootEntityId, 'assemblyRoot');
  if (assembly) {
    return traverseAnatomyGraph(world, assembly.rootPartId).sort();
  }
  const brains = world.getEntitiesWith('bodyBrain');
  for (const [partId, { bodyBrain }] of brains) {
    if (bodyBrain.rootEntityId === rootEntityId) {
      return traverseAnatomyGraph(world, partId).sort();
    }
  }
  return [rootEntityId];
}
/**
 * Собирает слоты взаимодействия (руки) со всех частей тела в единый плоский массив
 */
export function getAggregatedInteractionSlots(
  world: World,
  rootEntityId: EntityId
): AggregatedSlot[] {
  const parts = getAnatomyParts(world, rootEntityId);
  const result: AggregatedSlot[] = [];
  let globalIdx = 0;
  for (const partId of parts) {
    const slot = world.getComponent(partId, 'interactionSlots');
    if (slot) {
      const status = getPartStatus(world, partId);
      if (status === PartStatus.DESTROYED) {
        continue; // Разрушенная рука не предоставляет доступный слот
      }
      const isBroken = status === PartStatus.BROKEN;
      result.push({
        partId,
        localSlotIndex: 0,
        globalSlotIndex: globalIdx++,
        slot,
        isBroken,
      });
    }
  }
  return result;
}

/**
 * Поднимается вверх по цепочке владения (ownership.ownerId) и анатомии (brain.rootEntityId).
 */
export function getRootOwner(world: World, entityId: EntityId): EntityId | null {
  const visited = new Set<EntityId>();
  let current: EntityId | undefined = entityId;

  while (current && !visited.has(current)) {
    visited.add(current);

    const brain = world.getComponent(current, 'bodyBrain');
    if (brain && brain.rootEntityId) {
      return brain.rootEntityId;
    }

    const socketDef = world.getComponent(current, 'socketDef');
    if (socketDef) {
      const activeBrainId = findActiveBrain(world, current);
      if (activeBrainId) {
        const activeBrain = world.getComponent(activeBrainId, 'bodyBrain');
        if (activeBrain && activeBrain.rootEntityId) {
          return activeBrain.rootEntityId;
        }
      }
    }

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
 * Проверяет, является ли potentialDescendantId потомком ancestorId по владению или анатомии.
 */
export function isDescendantOf(
  world: World,
  descendantId: EntityId,
  ancestorId: EntityId
): boolean {
  if (descendantId === ancestorId) return true;

  const visited = new Set<EntityId>();
  let current: EntityId | undefined = descendantId;

  while (current && !visited.has(current)) {
    visited.add(current);
    if (current === ancestorId) return true;

    const ownership: OwnershipComponent | undefined = world.getComponent(current, 'ownership');
    if (ownership && ownership.ownerId) {
      current = ownership.ownerId;
      continue;
    }

    const socketDef = world.getComponent(current, 'socketDef');
    if (socketDef) {
      const activeBrainId = findActiveBrain(world, current);
      if (activeBrainId) {
        const activeBrain = world.getComponent(activeBrainId, 'bodyBrain');
        if (activeBrain && activeBrain.rootEntityId === ancestorId) {
          return true;
        }
      } else {
        const assembly = world.getComponent(ancestorId, 'assemblyRoot');
        if (assembly && (assembly.partIds?.includes(current) || assembly.rootPartId === current)) {
          return true;
        }
      }
    }

    break;
  }

  return false;
}

/**
 * Рекурсивно собирает все ID предметов, находящихся во всех областях экипировки существа и его частей,
 * а также в их ячейках взаимодействия.
 */
export function getAllEquippedDescendants(world: World, rootEntityId: EntityId): EntityId[] {
  const result: EntityId[] = [];
  const visited = new Set<EntityId>();

  function traverse(entityId: EntityId) {
    if (visited.has(entityId)) return;
    visited.add(entityId);

    const slot = world.getComponent(entityId, 'interactionSlots');
    if (slot && slot.itemId) {
      result.push(slot.itemId);
      traverse(slot.itemId);
    }

    const equip = world.getComponent(entityId, 'equip');
    if (!equip || !equip.equipmentAreas) return;

    for (const area of equip.equipmentAreas) {
      for (const itemId of area.itemIds) {
        result.push(itemId);
        traverse(itemId);
      }
    }
  }

  const parts = getAnatomyParts(world, rootEntityId);
  for (const partId of parts) traverse(partId);

  return result;
}

/**
 * Рекурсивно собирает все ID предметов, содержащихся в сущности (руки + экипировка + инвентарь).
 */
export function getAllContainedItems(world: World, rootEntityId: EntityId): EntityId[] {
  const result: EntityId[] = [];
  const visited = new Set<EntityId>();

  function traverse(entityId: EntityId) {
    if (visited.has(entityId)) return;
    visited.add(entityId);

    const slot = world.getComponent(entityId, 'interactionSlots');
    if (slot && slot.itemId) {
      result.push(slot.itemId);
      traverse(slot.itemId);
    }

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

  const parts = getAnatomyParts(world, rootEntityId);
  for (const partId of parts) traverse(partId);

  return result;
}

/**
 * Рекурсивно рассчитывает суммарный вес сущности с учетом собственного веса,
 * предметов в ячейках взаимодействия, экипировки и содержимого инвентарей.
 */
export function calculateTotalEntityWeight(
  world: World,
  entityId: EntityId,
  visited = new Set<EntityId>()
): number {
  if (visited.has(entityId)) return 0;
  visited.add(entityId);

  const physStats: PhysicsStatsComponent | undefined = world.getComponent(entityId, 'physicsStats');
  const item = world.getComponent(entityId, 'item');
  const countMultiplier = item?.count && item.count > 0 ? item.count : 1;
  let total = (physStats?.weight.current ?? 1) * countMultiplier;

  const slot = world.getComponent(entityId, 'interactionSlots');
  if (slot && slot.itemId) {
    total += calculateTotalEntityWeight(world, slot.itemId, visited);
  }

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
 * Ищет область экипировки в дереве персонажа (на частях существа или на экипированных предметах).
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

  const parts = getAnatomyParts(world, rootEntityId);
  for (const partId of parts) {
    const partEquip = world.getComponent(partId, 'equip');
    const partArea = partEquip?.equipmentAreas.find((a) => a.id === areaId);
    if (partArea) {
      return { containerId: partId, area: partArea };
    }
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

export interface DiscoveredInventory {
  containerId: EntityId;
  containerName: string;
  inventory: InventoryComponent;
  path: { id: EntityId; name: string }[];
  distance: number;
}

/**
 * Ищет все инвентари, привязанные к сущности (включая части тела, экипированные сумки, разгрузки и вложенные контейнеры).
 * Возвращает список инвентарей, отсортированный по возрастанию длины пути (начиная от самого короткого).
 */
export function findAllInventoriesInHierarchy(
  world: World,
  rootEntityId: EntityId
): DiscoveredInventory[] {
  const results: DiscoveredInventory[] = [];
  const visited = new Set<EntityId>();

  const getName = (id: EntityId): string => {
    const meta = world.getComponent(id, 'meta');
    const item = world.getComponent(id, 'item');
    return meta?.name || item?.name || id;
  };

  // 1. Проверяем саму корневую сущность (дистанция 0)
  visited.add(rootEntityId);
  const rootInv = world.getComponent(rootEntityId, 'inventory');
  if (rootInv) {
    results.push({
      containerId: rootEntityId,
      containerName: getName(rootEntityId),
      inventory: rootInv,
      path: [],
      distance: 0,
    });
  }

  interface QueueItem {
    id: EntityId;
    path: { id: EntityId; name: string }[];
  }

  const queue: QueueItem[] = [];

  // 2. Первичные дочерние узлы:
  // А) Части тела существа
  const parts = getAnatomyParts(world, rootEntityId);
  for (const partId of parts) {
    if (partId !== rootEntityId && !visited.has(partId)) {
      visited.add(partId);
      queue.push({
        id: partId,
        path: [{ id: partId, name: getName(partId) }],
      });
    }
  }

  // Б) Экипировка на rootEntityId
  const rootEquip = world.getComponent(rootEntityId, 'equip');
  if (rootEquip?.equipmentAreas) {
    for (const area of rootEquip.equipmentAreas) {
      for (const itemId of area.itemIds) {
        if (!visited.has(itemId)) {
          visited.add(itemId);
          queue.push({
            id: itemId,
            path: [{ id: itemId, name: getName(itemId) }],
          });
        }
      }
    }
  }

  // В) Слоты взаимодействия (руки) на rootEntityId
  const rootSlots = world.getComponent(rootEntityId, 'interactionSlots');
  if (rootSlots?.itemId && !visited.has(rootSlots.itemId)) {
    visited.add(rootSlots.itemId);
    queue.push({
      id: rootSlots.itemId,
      path: [{ id: rootSlots.itemId, name: getName(rootSlots.itemId) }],
    });
  }

  // Г) Предметы внутри собственного инвентаря
  if (rootInv?.slots) {
    for (const row of rootInv.slots) {
      for (const cell of row) {
        if (cell.itemId && !visited.has(cell.itemId)) {
          visited.add(cell.itemId);
          queue.push({
            id: cell.itemId,
            path: [{ id: cell.itemId, name: getName(cell.itemId) }],
          });
        }
      }
    }
  }

  // 3. Поиск в ширину (BFS)
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    const inv = world.getComponent(id, 'inventory');
    if (inv) {
      results.push({
        containerId: id,
        containerName: getName(id),
        inventory: inv,
        path,
        distance: path.length,
      });
    }

    // Расширение через области экипировки
    const eq = world.getComponent(id, 'equip');
    if (eq?.equipmentAreas) {
      for (const area of eq.equipmentAreas) {
        for (const subItemId of area.itemIds) {
          if (!visited.has(subItemId)) {
            visited.add(subItemId);
            queue.push({
              id: subItemId,
              path: [...path, { id: subItemId, name: getName(subItemId) }],
            });
          }
        }
      }
    }

    // Расширение через руки
    const slots = world.getComponent(id, 'interactionSlots');
    if (slots?.itemId && !visited.has(slots.itemId)) {
      visited.add(slots.itemId);
      queue.push({
        id: slots.itemId,
        path: [...path, { id: slots.itemId, name: getName(slots.itemId) }],
      });
    }

    // Расширение через ячейки инвентаря
    if (inv?.slots) {
      for (const row of inv.slots) {
        for (const cell of row) {
          if (cell.itemId && !visited.has(cell.itemId)) {
            visited.add(cell.itemId);
            queue.push({
              id: cell.itemId,
              path: [...path, { id: cell.itemId, name: getName(cell.itemId) }],
            });
          }
        }
      }
    }
  }

  // Гарантированная сортировка от самого короткого пути к самому длинному
  results.sort((a, b) => a.distance - b.distance);

  return results;
}
