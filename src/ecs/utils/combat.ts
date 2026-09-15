import { World } from '../World';
import { EntityId } from '../types';
import { getAnatomyParts } from './hierarchy';

export interface ArmorValues {
  defense: number;
  flatReduction: number;
}

export type CombatTarget =
  | { type: 'part'; partId: EntityId }
  | { type: 'connection'; partA: EntityId; socketIdA: string; partB: EntityId; socketIdB: string };

/**
 * Вычисляет локальную броню конкретной части тела (собственная броня + надетая на нее экипировка)
 */
export function getPartArmor(world: World, partId: EntityId): ArmorValues {
  let defense = 0;
  let flatReduction = 0;

  // Собственная броня части тела (если есть)
  const selfArmor = world.getComponent(partId, 'armorStats');
  if (selfArmor) {
    defense += selfArmor.defense.current;
    flatReduction += selfArmor.flatReduction.current;
  }

  // Броня от предметов, надетых в зоны экипировки этой части тела
  const equip = world.getComponent(partId, 'equip');
  if (equip && equip.equipmentAreas) {
    for (const area of equip.equipmentAreas) {
      for (const itemId of area.itemIds) {
        const itemArmor = world.getComponent(itemId, 'armorStats');
        if (itemArmor) {
          defense += itemArmor.defense.current;
          flatReduction += itemArmor.flatReduction.current;
        }
      }
    }
  }

  return { defense, flatReduction };
}

/**
 * Вычисляет броню соединения сокетов как среднее арифметическое брони двух соединяемых частей
 */
export function getConnectionArmor(world: World, partA: EntityId, partB: EntityId): ArmorValues {
  const armorA = getPartArmor(world, partA);
  const armorB = getPartArmor(world, partB);

  return {
    defense: (armorA.defense + armorB.defense) / 2,
    flatReduction: (armorA.flatReduction + armorB.flatReduction) / 2,
  };
}

/**
 * Выбирает случайную цель (часть тела или соединение) для получения урона
 * пропорционально их размерам (size / socketSize).
 */
export function selectDamageTarget(world: World, rootEntityId: EntityId): CombatTarget | null {
  const parts = getAnatomyParts(world, rootEntityId);
  if (parts.length === 0) return null;

  interface WeightedCandidate {
    weight: number;
    target: CombatTarget;
  }

  const candidates: WeightedCandidate[] = [];
  const processedConnections = new Set<string>();

  for (const partId of parts) {
    // 1. Добавляем часть тела как возможную цель
    const physStats = world.getComponent(partId, 'physicsStats');
    const partSize = physStats?.size ?? 10;
    candidates.push({
      weight: Math.max(1, partSize),
      target: { type: 'part', partId },
    });

    // 2. Добавляем соединения этой части тела
    const socketLink = world.getComponent(partId, 'socketLink');
    if (socketLink && socketLink.links) {
      for (const [socketId, link] of Object.entries(socketLink.links)) {
        const targetPartId = link.targetEntityId;
        // Уникальный ключ соединения, чтобы не дублировать ребро (A->B и B->A)
        const edgeKey =
          [partId, targetPartId].sort().join(':') + `_${socketId}_${link.targetSocketId}`;
        if (processedConnections.has(edgeKey)) continue;
        processedConnections.add(edgeKey);

        const connSize = link.socketSize ?? 20;
        candidates.push({
          weight: Math.max(1, connSize),
          target: {
            type: 'connection',
            partA: partId,
            socketIdA: socketId,
            partB: targetPartId,
            socketIdB: link.targetSocketId,
          },
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Рулетка (Weighted Random Selection)
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const c of candidates) {
    if (randomVal < c.weight) {
      return c.target;
    }
    randomVal -= c.weight;
  }

  return candidates[0].target;
}
