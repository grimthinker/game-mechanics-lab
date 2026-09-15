import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point } from '../../types';
import { createStat } from '../stats/StatEvaluator';

export function assembleBodyPart(
  world: World,
  _physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
): void {
  // 1. Тег
  world.addComponent(id, 'tag', { archetype: 'bodyPart', subType: config.tag?.subType });

  // 2. Мета
  world.addComponent(id, 'meta', {
    name: config.meta?.name || 'Часть тела',
    entityType: 'bodyPart',
  });

  // 3. Статы физики (само тело будет добавлено AnatomySystem, если часть окажется предметом)
  world.addComponent(id, 'physicsStats', {
    radius: createStat(config.physics?.radius || 10),
    weight: createStat(config.physics?.weight || 1),
    size: config.physics?.size || 10,
    isSolid: true,
  });

  // 4. Определение доступных сокетов
  if (config.socketDef) {
    world.addComponent(id, 'socketDef', JSON.parse(JSON.stringify(config.socketDef)));
  }

  // 5. Связи сокетов (соединения)
  if (config.socketLink) {
    world.addComponent(id, 'socketLink', JSON.parse(JSON.stringify(config.socketLink)));
  }

  // 6. Компонент мозга
  if (config.bodyBrain) {
    world.addComponent(id, 'bodyBrain', { ...config.bodyBrain });
  }

  // 7. Слоты взаимодействия
  if (config.interactionSlots) {
    world.addComponent(id, 'interactionSlots', JSON.parse(JSON.stringify(config.interactionSlots)));
  }

  // 8. Области экипировки
  if (config.equip) {
    world.addComponent(id, 'equip', JSON.parse(JSON.stringify(config.equip)));
  }

  // 9. Трансформация
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 });

  // 10. Структурная прочность (СП)
  const maxHealth = config.health?.maxHp ?? 100;
  world.addComponent(id, 'health', {
    current: config.health?.hp ?? maxHealth,
    max: createStat(maxHealth),
    isAlive: true,
    destructible: config.health?.destructible ?? true,
    hitFlashTimer: 0,
    healFlashTimer: 0,
  });

  // 11. Функциональная прочность (ФП)
  const maxFp = config.functionalHealth?.maxHp ?? 100;
  world.addComponent(id, 'functionalHealth', {
    current: config.functionalHealth?.hp ?? maxFp,
    max: createStat(maxFp),
    isFunctional: true,
  });

  // 12. Локомоция (Нога)
  if (config.locomotion) {
    world.addComponent(id, 'locomotion', {});
  }

  // 13. Ядро / Сердце
  if (config.heart) {
    world.addComponent(id, 'heart', { requiresBrain: config.heart.requiresBrain ?? true });
  }

  // 14. Зрение (Глаз)
  if (config.vision) {
    world.addComponent(id, 'vision', {
      fovAngle: createStat(config.vision.fovAngle),
      clarity: createStat(config.vision.clarity),
      maxDistance: createStat(config.vision.maxDistance),
    });
  }

  // 15. Слух (Ухо)
  if (config.hearing) {
    world.addComponent(id, 'hearing', {
      sensitivity: createStat(config.hearing.sensitivity),
      maxDistance: createStat(config.hearing.maxDistance),
    });
  }
}
