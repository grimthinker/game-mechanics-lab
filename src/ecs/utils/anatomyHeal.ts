import { World } from '../World';
import { EntityId } from '../types';
import { getAnatomyParts } from './hierarchy';
import { findActiveBrain } from './anatomy';
import { evaluateConsciousness, ConsciousnessState } from './anatomyStatus';

export function applyAnatomyHeal(
  world: World,
  targetId: EntityId,
  amount: number,
  triggerFlash: boolean = true
): void {
  const tag = world.getComponent(targetId, 'tag');
  const hasAnatomy =
    world.getComponent(targetId, 'assemblyRoot') ||
    world.getComponent(targetId, 'socketDef') ||
    tag?.archetype === 'creature';

  if (!hasAnatomy) {
    // Обычное лечение предметов или препятствий (СП)
    const health = world.getComponent(targetId, 'health');
    if (health && health.current < health.max.current) {
      health.current = Math.min(health.max.current, health.current + amount);
      if (triggerFlash) health.healFlashTimer = 0.2;
    }
    return;
  }

  // Лечение живого существа / анатомической сборки
  const parts = getAnatomyParts(world, targetId);

  // 1. Лечение функциональной прочности (ФП) всех частей тела
  for (const partId of parts) {
    const fp = world.getComponent(partId, 'functionalHealth');
    if (fp && fp.current < fp.max.current) {
      fp.current = Math.min(fp.max.current, fp.current + amount);
      fp.isFunctional = fp.current >= 0;
    }

    const health = world.getComponent(partId, 'health');
    if (health && triggerFlash) {
      health.healFlashTimer = 0.2;
    }

    // 2. Лечение существующих соединений сокетов
    const socketLink = world.getComponent(partId, 'socketLink');
    if (socketLink && socketLink.links) {
      for (const [socketId, link] of Object.entries(socketLink.links)) {
        const maxStr = link.maxStrength.current;
        if (link.currentStrength < maxStr) {
          link.currentStrength = Math.min(maxStr, link.currentStrength + amount);

          // Синхронизируем зеркальный линк на соединенной части
          const targetPartId = link.targetEntityId;
          const targetSocketId = link.targetSocketId;
          const targetLink = world.getComponent(targetPartId, 'socketLink')?.links[targetSocketId];
          if (targetLink) {
            targetLink.currentStrength = link.currentStrength;
          }
        }
      }
    }
  }

  // 3. Проверка восстановления жизнедеятельности и сознания через evaluateConsciousness
  const consciousness = evaluateConsciousness(world, targetId);
  const rootHealth = world.getComponent(targetId, 'health');

  if (consciousness !== ConsciousnessState.DEAD && rootHealth && !rootHealth.isAlive) {
    rootHealth.isAlive = true;
    rootHealth.current = rootHealth.max.current;
    const parts = getAnatomyParts(world, targetId);
    for (const pId of parts) {
      const b = world.getComponent(pId, 'bodyBrain');
      if (b) b.isActive = true;
    }
  }
}
