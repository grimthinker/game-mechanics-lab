import { World } from '../World';
import { EntityId } from '../types';
import { calculateTotalEntityWeight } from './hierarchy';
import { createStat } from '../stats/StatEvaluator';

/**
 * Ищет активный логический мозг (BrainComponent) напрямую у сущности,
 * либо через анатомический граф (bodyBrain).
 */
export function getEffectiveLogicBrain(
  world: World,
  entityId: EntityId
): import('../../ai/core').BTLogicComponent | undefined {
  let brain = world.getComponent(entityId, 'brain') as
    import('../../ai/core').BTLogicComponent | undefined;
  if (!brain) {
    const activeBrainId = findActiveBrain(world, entityId);
    if (activeBrainId) {
      brain = world.getComponent(activeBrainId, 'brain') as
        import('../../ai/core').BTLogicComponent | undefined;
    }
  }
  return brain;
}

/**
 * Возвращает массив всех EntityId, соединенных в единый граф анатомии
 */
export function traverseAnatomyGraph(world: World, startId: EntityId): EntityId[] {
  const visited = new Set<EntityId>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const socketLink = world.getComponent(current, 'socketLink');
    if (socketLink) {
      for (const link of Object.values(socketLink.links)) {
        if (!visited.has(link.targetEntityId)) {
          queue.push(link.targetEntityId);
        }
      }
    }
  }

  return Array.from(visited);
}

/**
 * Вычисляет суммарный вес и максимальный радиус системы соединенных частей
 */
export function calculateSystemWeightAndRadius(
  world: World,
  startId: EntityId
): { totalWeight: number; maxRadius: number } {
  const parts = traverseAnatomyGraph(world, startId);
  let totalWeight = 0;
  let maxRadius = 0;

  for (const partId of parts) {
    // Включает собственный вес, вес инвентаря и экипированных предметов
    totalWeight += calculateTotalEntityWeight(world, partId);

    const physStats = world.getComponent(partId, 'physicsStats');
    if (physStats) {
      const radius = physStats.radius.current;
      if (radius > maxRadius) maxRadius = radius;
    }
  }

  return { totalWeight, maxRadius };
}

/**
 * Находит часть тела с самым сильным активным компонентом bodyBrain в графе.
 * Корректно находит части, даже если на вход передан ID абстрактного Корня.
 */
export function findActiveBrain(world: World, startId: EntityId): EntityId | null {
  let actualStartId = startId;
  const assembly = world.getComponent(startId, 'assemblyRoot');
  if (assembly) {
    actualStartId = assembly.rootPartId;
  } else if (!world.getComponent(startId, 'socketDef')) {
    const brains = world.getEntitiesWith('bodyBrain');
    for (const [partId, { bodyBrain }] of brains) {
      if (bodyBrain.rootEntityId === startId) {
        actualStartId = partId;
        break;
      }
    }
  }

  const parts = traverseAnatomyGraph(world, actualStartId);

  // Без сердца система частей тела не является существом — мозг не функционирует
  const hasHeart = parts.some((pId) => world.getComponent(pId, 'heart') !== undefined);
  if (!hasHeart) {
    return null;
  }

  let bestBrainId: EntityId | null = null;
  let maxPower = -Infinity;

  for (const partId of parts) {
    const brain = world.getComponent(partId, 'bodyBrain');
    if (brain && brain.isActive && brain.power > maxPower) {
      maxPower = brain.power;
      bestBrainId = partId;
    }
  }

  return bestBrainId;
}

/**
 * Вспомогательная функция: вычисляет вес подграфа при "виртуальном" разрыве одного соединения.
 * Это необходимо для проверки правила: Strength(Link) >= Min(Weight(SideA), Weight(SideB)).
 */
function getSubgraphWeight(world: World, start: EntityId, ignoreTarget: EntityId): number {
  const visited = new Set<EntityId>();
  const queue = [start];

  // Помещаем разорванный узел в visited, чтобы алгоритм не мог пойти в ту сторону графа
  visited.add(ignoreTarget);

  let totalWeight = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;

    totalWeight += calculateTotalEntityWeight(world, current);

    const socketLink = world.getComponent(current, 'socketLink');
    if (socketLink) {
      for (const link of Object.values(socketLink.links)) {
        if (!visited.has(link.targetEntityId)) {
          visited.add(link.targetEntityId);
          queue.push(link.targetEntityId);
        }
      }
    }
  }

  return totalWeight;
}

/**
 * Проверяет, можно ли соединить два сокета с учетом всех правил совместимости и весовых лимитов системы.
 */
export function canConnectSockets(
  world: World,
  partA: EntityId,
  socketIdA: string,
  partB: EntityId,
  socketIdB: string
): boolean {
  const defA = world.getComponent(partA, 'socketDef');
  const defB = world.getComponent(partB, 'socketDef');

  if (!defA || !defB) return false;

  const sockA = defA.sockets[socketIdA];
  const sockB = defB.sockets[socketIdB];

  if (!sockA || !sockB) return false;

  // 1. Проверка типов
  if (sockA.type !== sockB.type) return false;

  // 2. Проверка размеров сокетов: калибр ответного сокета должен укладываться в допустимый лимит
  if (sockA.maxChildSize !== undefined && sockB.size > sockA.maxChildSize) return false;
  if (sockB.maxChildSize !== undefined && sockA.size > sockB.maxChildSize) return false;

  // 3. Быстрая проверка прочности самого соединения двух подсистем
  const weightA = calculateSystemWeightAndRadius(world, partA).totalWeight;
  const weightB = calculateSystemWeightAndRadius(world, partB).totalWeight;

  const combinedStrength = sockA.strength + sockB.strength;
  const minWeight = Math.min(weightA, weightB);

  if (combinedStrength < minWeight) return false;

  // 4. Симуляция соединения для проверки всех остальных соединений в результирующем графе
  const linkA = world.getComponent(partA, 'socketLink');
  const linkB = world.getComponent(partB, 'socketLink');

  let addedLinkA = false;
  let addedLinkB = false;

  if (!linkA) {
    world.addComponent(partA, 'socketLink', { links: {} });
    addedLinkA = true;
  }
  if (!linkB) {
    world.addComponent(partB, 'socketLink', { links: {} });
    addedLinkB = true;
  }

  const currentLinkA = world.getComponent(partA, 'socketLink')!;
  const currentLinkB = world.getComponent(partB, 'socketLink')!;

  const connectionSocketSize = sockA.size + sockB.size;

  currentLinkA.links[socketIdA] = {
    targetEntityId: partB,
    targetSocketId: socketIdB,
    currentStrength: combinedStrength,
    maxStrength: createStat(combinedStrength),
    socketSize: connectionSocketSize,
  };
  currentLinkB.links[socketIdB] = {
    targetEntityId: partA,
    targetSocketId: socketIdA,
    currentStrength: combinedStrength,
    maxStrength: createStat(combinedStrength),
    socketSize: connectionSocketSize,
  };

  const allParts = traverseAnatomyGraph(world, partA);
  let isValid = true;

  for (const partId of allParts) {
    const sl = world.getComponent(partId, 'socketLink');
    if (!sl) continue;

    for (const link of Object.values(sl.links)) {
      // Имитируем разрыв текущего соединения и считаем вес получившихся подграфов
      const weight1 = getSubgraphWeight(world, partId, link.targetEntityId);
      const weight2 = getSubgraphWeight(world, link.targetEntityId, partId);

      if (link.currentStrength < Math.min(weight1, weight2)) {
        isValid = false;
        break;
      }
    }
    if (!isValid) break;
  }

  // Откат симуляции
  delete currentLinkA.links[socketIdA];
  delete currentLinkB.links[socketIdB];
  if (addedLinkA) world.removeComponent(partA, 'socketLink');
  if (addedLinkB) world.removeComponent(partB, 'socketLink');

  return isValid;
}
