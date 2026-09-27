import RAPIER from '@dimforge/rapier3d-compat';
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
import { Point, Vec3 } from '../../types';
import {
  Radians,
  isConvexPolygon,
  calculateBoundingRadius,
  createRectanglePoints,
} from '../../utils';
import { createStat } from '../stats/StatEvaluator';
import { fastClone } from '../utils/clone';

export function createHouseConfig(position?: Vec3, angle: Radians = 0 as Radians): EntityConfig {
  const width = 5.0;
  const depth = 5.4;
  const height = 5.5;

  return {
    tag: { archetype: 'obstacle', subType: 'house' },
    meta: { name: 'Дом', entityType: 'obstacle', destructible: false },
    visualModel: { modelId: 'proc://prop/house' },
    transform: {
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      z: position?.z ?? 0,
      rotation: { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) },
      angle,
    },
    physics: {
      radius: 2.7,
      height,
      weight: 50000,
      isSolid: true,
      points: createRectanglePoints(width, depth),
    },
    health: {
      maxHp: 5000,
      hp: 5000,
      destructible: false,
    },
  };
}

export function createFenceConfig(
  length: number = 2.4,
  position?: Vec3,
  angle: Radians = 0 as Radians
): EntityConfig {
  const depth = 0.25;
  const height = 1.15;

  return {
    tag: { archetype: 'obstacle', subType: 'fence' },
    meta: { name: 'Забор', entityType: 'obstacle', destructible: true },
    visualModel: { modelId: 'proc://prop/fence' },
    transform: {
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      z: position?.z ?? 0,
      rotation: { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) },
      angle,
    },
    physics: {
      radius: length / 2,
      height,
      weight: 80,
      isSolid: true,
      points: createRectanglePoints(length, depth),
    },
    health: {
      maxHp: 80,
      hp: 80,
      destructible: true,
    },
  };
}

const ROCK_PRESETS: Record<
  number,
  { width: number; depth: number; height: number; radius: number; weight: number }
> = {
  1: { width: 2.0, depth: 1.4, height: 1.25, radius: 1.1, weight: 2500 },
  2: { width: 2.2, depth: 1.7, height: 0.75, radius: 1.2, weight: 2200 },
  3: { width: 2.3, depth: 2.1, height: 1.5, radius: 1.2, weight: 3200 },
  4: { width: 2.2, depth: 2.0, height: 1.6, radius: 1.2, weight: 3000 },
  5: { width: 2.1, depth: 1.7, height: 1.45, radius: 1.1, weight: 2800 },
};

export function createRockConfig(
  variant: 1 | 2 | 3 | 4 | 5 = 1,
  scale: number = 1.0,
  position?: Vec3,
  angle: Radians = 0 as Radians
): EntityConfig {
  const p = ROCK_PRESETS[variant] || ROCK_PRESETS[1];
  const width = p.width * scale;
  const depth = p.depth * scale;
  const height = p.height * scale;
  const radius = p.radius * scale;
  const weight = Math.round(p.weight * Math.pow(scale, 3));

  return {
    tag: { archetype: 'obstacle', subType: 'rock' },
    meta: { name: `Камень ${variant}`, entityType: 'obstacle', destructible: false },
    visualModel: { modelId: `proc://prop/rock_${variant}` },
    transform: {
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      z: position?.z ?? 0,
      rotation: { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) },
      angle,
    },
    physics: {
      radius,
      height,
      weight,
      isSolid: true,
      points: createRectanglePoints(width, depth),
    },
    health: {
      maxHp: 2000,
      hp: 2000,
      destructible: false,
    },
  };
}

export function assembleObstacle(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Vec3
): void {
  const defaultRadius = config.physics?.radius ?? 1.0;
  const points =
    config.physics?.points ?? createRectanglePoints(defaultRadius * 2, defaultRadius * 2);

  // Валидация выпуклости полигона
  if (!isConvexPolygon(points)) {
    console.warn(
      `[assembleObstacle] Полигон для сущности ${id} не является выпуклым. Препятствие не создано.`
    );
    world.removeEntity(id);
    return;
  }

  const name = config.meta?.name || 'Препятствие';
  const destructible = config.meta?.destructible ?? false;
  const maxHp = config.health?.maxHp ?? 100;
  const hp = config.health?.hp ?? maxHp;
  const angle = (config.transform?.angle ?? 0) as Radians;
  const isSolid = config.physics?.isSolid ?? true;
  const boundingRadius = calculateBoundingRadius(points);

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'obstacle', subType: config.tag?.subType });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name,
    entityType: 'obstacle',
    destructible,
  });

  // 3. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(boundingRadius),
    height: createStat(config.physics?.height ?? 1.5),
    weight: createStat(config.physics?.weight ?? 1000),
    isSolid,
    points: fastClone(points),
  });

  // 4. Здоровье (обязательный компонент)
  world.addComponent(id, 'health', {
    current: hp,
    max: createStat(maxHp),
    isAlive: hp > 0,
    destructible,
    hitFlashTimer: 0,
    healFlashTimer: 0,
    healthBarTimer: 0,
  });

  // 5. Трансформация в 3D
  const posX = position?.x ?? config.transform?.x ?? 0;
  const posY = position?.y ?? config.transform?.y ?? 0;
  const posZ = position?.z ?? config.transform?.z ?? 0;
  const rotation = config.transform?.rotation
    ? { ...config.transform.rotation }
    : { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) };

  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation,
    angle,
  });

  // 6. Физическое тело Fixed Cuboid (Rapier3D)
  const category = CollisionCategory.OBSTACLE;
  const mask = isSolid && hp > 0 ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

  // Рассчитываем размеры кубоида по точкам
  let minX = points[0]?.x ?? -2,
    maxX = points[0]?.x ?? 2;
  let minY = points[0]?.y ?? -0.5,
    maxY = points[0]?.y ?? 0.5;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(0.2, maxX - minX);
  const depth = Math.max(0.2, maxY - minY);
  const height = config.physics?.height ?? 1.5;

  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;

  let rawBody: RAPIER.RigidBody | undefined;
  let rawCollider: RAPIER.Collider | undefined;

  if (physics.driver && physics.driver.isReady) {
    const pos3D = { x: posX, y: posY, z: posZ };
    rawBody = physics.driver.createFixedBody(pos3D, id);
    rawBody.setRotation(rotation, false);

    // Смещаем коллайдер вверх на hy, чтобы основание стояло на плоскости Y=0
    rawCollider = physics.driver.createCuboidCollider(hx, hy, hz, rawBody, 0, {
      x: 0,
      y: hy,
      z: 0,
    });
  }
  world.addComponent(id, 'physicsBody', {
    rawBody,
    rawCollider,
    bodyType: 'fixed',
    isStatic: true,
    category,
    mask,
  });

  // 7. Компонент видимости и визуальная модель
  if (config.visualModel) {
    world.addComponent(id, 'visualModel', fastClone(config.visualModel));
  }

  world.addComponent(id, 'renderable', {
    zIndex: RENDER_Z_INDEX.OBSTACLES,
    isVisible: true,
    syncWithTransform: true,
  });
}
