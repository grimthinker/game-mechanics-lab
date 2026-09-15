import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { EntityId } from '../types';
import { getAnatomyParts } from './hierarchy';
import { findActiveBrain } from './anatomy';
import { getPartArmor, getConnectionArmor, selectDamageTarget } from './combat';
import { killEntity } from './health';

export function destroyPartRecursive(
  world: World,
  _physics: PhysicsSystem,
  partId: EntityId
): void {
  if (!world.getEntity(partId)) return;

  // 1. Находим все остальные части в мире и обрываем связи, ведущие к удаляемой части
  const allEntities = world.getAllEntities();
  for (const [otherId, comp] of allEntities) {
    if (comp.socketLink && comp.socketLink.links) {
      for (const [sockId, link] of Object.entries(comp.socketLink.links)) {
        if (link.targetEntityId === partId) {
          delete comp.socketLink.links[sockId];
        }
      }
    }
  }

  // 2. Удаляем саму сущность части тела
  world.removeEntity(partId);
}

export function applyDamageToPart(
  world: World,
  physics: PhysicsSystem,
  partId: EntityId,
  rawDamage: number,
  visited: Set<string>
): void {
  const fp = world.getComponent(partId, 'functionalHealth');
  if (!fp) return;

  const partKey = `part_${partId}`;
  if (visited.has(partKey)) return;
  visited.add(partKey);

  const minFp = -2 * fp.max.current;
  const nextFp = fp.current - rawDamage;

  if (nextFp < minFp) {
    const overflow = minFp - nextFp;
    fp.current = minFp;
    fp.isFunctional = false;

    if (overflow > 0) {
      resolveOverflowFromPart(world, physics, partId, overflow, visited);
    }
  } else {
    fp.current = nextFp;
    fp.isFunctional = fp.current >= 0;
  }
}

function resolveOverflowFromPart(
  world: World,
  physics: PhysicsSystem,
  partId: EntityId,
  overflow: number,
  visited: Set<string>
): void {
  const socketLink = world.getComponent(partId, 'socketLink');
  if (!socketLink || !socketLink.links) {
    handleDeadEndOverflow(world, physics, partId, overflow);
    return;
  }

  interface ConnCandidate {
    socketId: string;
    targetPartId: string;
    targetSocketId: string;
    weight: number;
    edgeKey: string;
  }

  const candidates: ConnCandidate[] = [];
  for (const [socketId, link] of Object.entries(socketLink.links)) {
    const targetPartId = link.targetEntityId;
    const edgeKey = [partId, targetPartId].sort().join(':') + `_${socketId}_${link.targetSocketId}`;
    if (visited.has(edgeKey)) continue;

    candidates.push({
      socketId,
      targetPartId,
      targetSocketId: link.targetSocketId,
      weight: Math.max(1, link.socketSize ?? 20),
      edgeKey,
    });
  }

  if (candidates.length === 0) {
    handleDeadEndOverflow(world, physics, partId, overflow);
    return;
  }

  // Взвешенный случайный выбор соединения (рулетка)
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  let chosen = candidates[0];
  for (const c of candidates) {
    if (r < c.weight) {
      chosen = c;
      break;
    }
    r -= c.weight;
  }

  visited.add(chosen.edgeKey);
  applyDamageToConnection(
    world,
    physics,
    partId,
    chosen.socketId,
    chosen.targetPartId,
    chosen.targetSocketId,
    overflow,
    visited
  );
}

export function applyDamageToConnection(
  world: World,
  physics: PhysicsSystem,
  partA: EntityId,
  socketIdA: string,
  partB: EntityId,
  socketIdB: string,
  rawDamage: number,
  visited: Set<string>
): void {
  const linkA = world.getComponent(partA, 'socketLink')?.links[socketIdA];
  if (!linkA) return;

  const maxStr = linkA.maxStrength.current;
  const nextStr = linkA.currentStrength - rawDamage;

  const edgeKey = [partA, partB].sort().join(':') + `_${socketIdA}_${socketIdB}`;
  visited.add(edgeKey);

  if (nextStr < -maxStr) {
    const overflow = -maxStr - nextStr;

    // Разрыв соединения: удаляем линк из обеих частей
    delete world.getComponent(partA, 'socketLink')?.links[socketIdA];
    delete world.getComponent(partB, 'socketLink')?.links[socketIdB];

    if (overflow > 0) {
      // Перелив на одну из двух соединенных частей пропорционально их размеру
      const sizeA = world.getComponent(partA, 'physicsStats')?.size ?? 10;
      const sizeB = world.getComponent(partB, 'physicsStats')?.size ?? 10;
      const totalSize = sizeA + sizeB;
      const targetPart = Math.random() * totalSize < sizeA ? partA : partB;

      applyDamageToPart(world, physics, targetPart, overflow, visited);
    }
  } else {
    linkA.currentStrength = nextStr;
    const linkB = world.getComponent(partB, 'socketLink')?.links[socketIdB];
    if (linkB) linkB.currentStrength = nextStr;
  }
}

function handleDeadEndOverflow(
  world: World,
  physics: PhysicsSystem,
  partId: EntityId,
  overflow: number
): void {
  const brainPartId = findActiveBrain(world, partId);
  let isDead = false;
  if (brainPartId) {
    const brainFp = world.getComponent(brainPartId, 'functionalHealth');
    if (brainFp && brainFp.current < -brainFp.max.current) {
      isDead = true;
    }
  } else {
    isDead = true;
  }

  if (isDead) {
    // Урон переходит в структурную прочность (СП / health) этой части тела
    const health = world.getComponent(partId, 'health');
    if (health) {
      health.current = Math.max(0, health.current - overflow);
      if (health.current <= 0) {
        destroyPartRecursive(world, physics, partId);
      }
    }
  }
}

export function checkCreatureDeath(world: World, rootEntityId: EntityId): void {
  const brainPartId = findActiveBrain(world, rootEntityId);
  if (!brainPartId) {
    killCreature(world, rootEntityId);
    return;
  }

  const brainFp = world.getComponent(brainPartId, 'functionalHealth');
  if (brainFp && brainFp.current < -brainFp.max.current) {
    killCreature(world, rootEntityId);
  }
}

function killCreature(world: World, rootEntityId: EntityId): void {
  const health = world.getComponent(rootEntityId, 'health');
  if (health && health.isAlive) {
    health.isAlive = false;
    health.current = 0;
    const parts = getAnatomyParts(world, rootEntityId);
    for (const pId of parts) {
      const b = world.getComponent(pId, 'bodyBrain');
      if (b) b.isActive = false;
    }
    killEntity(world, rootEntityId);
  }
}

export function applyWeaponDamageToCreature(
  world: World,
  physics: PhysicsSystem,
  creatureRootId: EntityId,
  rawDamage: number
): void {
  const target = selectDamageTarget(world, creatureRootId);
  if (!target) return;

  const visited = new Set<string>();

  if (target.type === 'part') {
    const armor = getPartArmor(world, target.partId);
    const mitigated = Math.max(
      0,
      rawDamage * (1 - Math.min(0.9, Math.max(0, armor.defense / 100))) - armor.flatReduction
    );
    applyDamageToPart(world, physics, target.partId, mitigated, visited);
  } else {
    const armor = getConnectionArmor(world, target.partA, target.partB);
    const mitigated = Math.max(
      0,
      rawDamage * (1 - Math.min(0.9, Math.max(0, armor.defense / 100))) - armor.flatReduction
    );
    applyDamageToConnection(
      world,
      physics,
      target.partA,
      target.socketIdA,
      target.partB,
      target.socketIdB,
      mitigated,
      visited
    );
  }

  checkCreatureDeath(world, creatureRootId);
}

export function applyZoneDamageToCreature(
  world: World,
  physics: PhysicsSystem,
  creatureRootId: EntityId,
  damageAmount: number
): void {
  const parts = getAnatomyParts(world, creatureRootId);
  const visited = new Set<string>();
  // Зоны наносят урон всем частям одновременно, минуя соединения и броню
  for (const partId of parts) {
    applyDamageToPart(world, physics, partId, damageAmount, visited);
  }
  checkCreatureDeath(world, creatureRootId);
}
