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
import { createStat } from '../stats/StatEvaluator';

export function getDefaultZoneName(effect: ZoneEffectType): string {
  switch (effect) {
    case 'damage':
      return 'Зона урона';
    case 'heal':
      return 'Зона лечения';
    case 'repel':
      return 'Силовое поле (Отталкивание)';
    case 'attract':
      return 'Воронка (Притягивание)';
  }
}

export function getZoneVisuals(effect: ZoneEffectType): {
  fillColor: string;
  strokeColor: string;
  icon: string;
} {
  switch (effect) {
    case 'damage':
      return { fillColor: 'rgba(231, 76, 60, 0.2)', strokeColor: '#e74c3c', icon: '☠️' };
    case 'heal':
      return { fillColor: 'rgba(46, 204, 113, 0.2)', strokeColor: '#2ecc71', icon: '❤️' };
    case 'repel':
      return { fillColor: 'rgba(243, 156, 18, 0.2)', strokeColor: '#f39c12', icon: '💨' };
    case 'attract':
      return { fillColor: 'rgba(155, 89, 182, 0.2)', strokeColor: '#9b59b6', icon: '🌀' };
  }
}

export function createZoneConfig(
  effect: ZoneEffectType,
  radius: number = 80,
  valuePerSec: number = 15,
  name?: string,
  ignoreParent: boolean = true,
  destroyOnParentDeath: boolean = false,
  destroyOnParentRemoval: boolean = true,
  distanceAttenuation: boolean = false,
  centerValue: number = 150,
  boundaryValue: number = 30
): EntityConfig {
  return {
    tag: { archetype: 'zone', subType: effect },
    meta: {
      name: name || getDefaultZoneName(effect),
      entityType: 'zone',
    },
    zoneTrigger: {
      effect,
      radius,
      valuePerSec,
      ignoreParent,
      destroyOnParentDeath,
      destroyOnParentRemoval,
      distanceAttenuation,
      centerValue,
      boundaryValue,
    },
    physics: {
      radius,
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
    ignoreParent: true,
  };

  const effect = zTrigger.effect;
  const radius = zTrigger.radius;
  const name = config.meta?.name ?? getDefaultZoneName(effect);

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

  // 4. Компонент привязки (если передан)
  if (config.attachment) {
    world.addComponent(id, 'attachment', config.attachment);
  }

  // 5. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    weight: createStat(1),
    isSolid: false,
  });

  // 6. Трансформация и тело-сенсор
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = false;
  const category = CollisionCategory.TRIGGER_ZONE;
  const mask = CollisionCategory.CREATURE;
  (body as any).category = category;
  (body as any).mask = mask;
  world.addComponent(id, 'physicsBody', { body, isStatic: false, category, mask, isTrigger: true });
  physics.registerBody(id, body);

  // 7. Универсальный рендер (слой 0 — земля/зоны)
  const visuals = getZoneVisuals(effect);

  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.ZONES,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'circle',
        radius,
        fill: visuals.fillColor,
        stroke: visuals.strokeColor,
        strokeWidth: 2,
        dash: [6, 6],
      },
      {
        kind: 'text',
        text: visuals.icon,
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
        fill: visuals.strokeColor,
        ignoreRotation: true,
        align: 'center',
        baseline: 'top',
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
