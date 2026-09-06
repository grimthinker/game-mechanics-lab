import { Circle } from 'detect-collisions';
import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import {
  EntityId,
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  RENDER_Z_INDEX,
  RenderableComponent,
  ZoneEffectType,
} from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';

export function createZoneConfig(
  effect: ZoneEffectType,
  radius: number = 80,
  valuePerSec: number = 15,
  name?: string
): EntityConfig {
  return {
    tag: { archetype: 'zone', subType: effect },
    meta: {
      name: name || (effect === 'damage' ? 'Зона урона' : 'Зона лечения'),
      entityType: 'zone',
    },
    zoneTrigger: {
      effect,
      radius,
      valuePerSec,
    },
    physics: {
      radius: 16,
      weight: 1,
      isSolid: false,
    },
  };
}

export function assembleZone(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
): void {
  const zTrigger = config.zoneTrigger ?? {
    effect: 'damage',
    radius: 80,
    valuePerSec: 15,
  };

  const effect = zTrigger.effect;
  const radius = zTrigger.radius;
  const name = config.meta?.name ?? (effect === 'damage' ? 'Зона урона' : 'Зона лечения');

  // 1. Тег
  world.addComponent(id, 'tag', { archetype: 'zone', subType: effect });

  // 2. Мета
  world.addComponent(id, 'meta', {
    name,
    state: 'idle',
    entityType: 'zone',
  });

  // 3. Компонент триггера
  world.addComponent(id, 'zoneTrigger', zTrigger);

  // 4. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: { base: radius as any, current: radius as any },
    weight: { base: 1, current: 1 },
    isSolid: { base: false, current: false },
  });

  // 5. Трансформация и тело-сенсор
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = true;
  const category = CollisionCategory.TRIGGER_ZONE;
  const mask = COLLISION_MASK_ALL;
  (body as any).category = category;
  (body as any).mask = mask;
  world.addComponent(id, 'physicsBody', { body, isStatic: true, category, mask, isTrigger: true });
  physics.registerBody(id, body);

  // 6. Универсальный рендер (слой 0 — земля/зоны)
  const isDamage = effect === 'damage';
  const fillColor = isDamage ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)';
  const strokeColor = isDamage ? '#e74c3c' : '#2ecc71';
  const icon = isDamage ? '☠️' : '❤️';

  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.ZONES,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'circle',
        radius,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: 2,
        dash: [6, 6],
      },
      {
        kind: 'text',
        text: icon,
        font: '20px sans-serif',
        fill: '#ffffff',
        ignoreRotation: true,
        align: 'center',
        baseline: 'middle',
      },
      {
        kind: 'text',
        text: name,
        offset: { x: 0, y: radius + 8 },
        font: '11px sans-serif',
        fill: strokeColor,
        ignoreRotation: true,
        align: 'center',
        baseline: 'top',
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}