import { Circle } from 'detect-collisions';
import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import {
  EntityId,
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  RENDER_Z_INDEX,
  RenderableComponent,
} from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';
import { createStat } from '../stats/StatEvaluator';

export function assembleItem(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
): void {
  const itemData = config.item ?? { name: 'Предмет', type: 'weapon', maxStack: 1 };
  const radius = config.physics?.radius ?? 16;
  const weight = config.physics?.weight ?? 1;
  const isSolid = config.physics?.isSolid ?? true;

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'item', subType: itemData.type });

  // 2. Базовые данные предмета
  world.addComponent(id, 'item', itemData);

  // 3. Мета-информация
  world.addComponent(id, 'meta', {
    name: itemData.name,
    state: 'idle',
    entityType: 'item',
  });

  // 4. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    weight: createStat(weight),
    isSolid,
  });

  // 5. Специфические компоненты экипировки
  if (itemData.type === 'weapon') {
    const ws = config.weaponStats ?? {};
    world.addComponent(id, 'weaponStats', {
      baseDamage: createStat(ws.baseDamage ?? 20),
      prepTime: createStat(ws.prepTime ?? 0.2),
      castTime: createStat(ws.castTime ?? 0),
      recoveryTime: createStat(ws.recoveryTime ?? 0.3),
      prepTurnSlow: ws.prepTurnSlow ?? 0.5,
      recoveryTurnSlow: ws.recoveryTurnSlow ?? 0.8,
      prepMoveSlow: ws.prepMoveSlow ?? 0.5,
      recoveryMoveSlow: ws.recoveryMoveSlow ?? 0.8,
      castMoveSlow: ws.castMoveSlow ?? 0.5,
      minMultiplier: ws.minMultiplier ?? 0.8,
      maxMultiplier: ws.maxMultiplier ?? 1.2,
      critChance: ws.critChance ?? 0.1,
      critMultiplier: ws.critMultiplier ?? 2.0,
    });

    if (config.weaponZone) {
      world.addComponent(id, 'weaponZone', JSON.parse(JSON.stringify(config.weaponZone)));
    }
  } else if (itemData.type === 'armor') {
    const as = config.armorStats ?? {};
    world.addComponent(id, 'armorStats', {
      defense: createStat(as.defense ?? 0),
      flatReduction: createStat(as.flatReduction ?? 0),
    });
  } else if (itemData.type === 'bag') {
    const w = config.inventory?.size.width ?? 6;
    const h = config.inventory?.size.height ?? 4;
    const slots =
      config.inventory?.slots ??
      Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ({ itemId: null, count: 0 }))
      );
    world.addComponent(id, 'inventory', {
      size: { width: w, height: h },
      slots,
    });
  }

  // 6. Трансформация и физическое тело на карте
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = false;
  const category = CollisionCategory.ITEM;
  const mask = isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
  (body as any).category = category;
  (body as any).mask = mask;
  world.addComponent(id, 'physicsBody', { body, isStatic: false, category, mask });
  physics.registerBody(id, body);

  // 7. Универсальный компонент отрисовки (Renderable)
  let color = '#7f8c8d';
  if (itemData.type === 'weapon') color = '#f1c40f';
  else if (itemData.type === 'armor') color = '#3498db';
  else if (itemData.type === 'bag') color = '#2ecc71';

  const size = radius * 1.6;
  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.ITEMS,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'rect',
        width: size,
        height: size,
        fill: color,
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
