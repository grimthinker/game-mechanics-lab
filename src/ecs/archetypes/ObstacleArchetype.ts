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

export function assembleObstacle(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Vec3
): void {
  const points = config.physics?.points ?? createRectanglePoints(100, 40);

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
  world.addComponent(id, 'tag', { archetype: 'obstacle' });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name,
    entityType: 'obstacle',
    destructible,
  });

  // 3. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(boundingRadius),
    weight: createStat(1000),
    isSolid,
    points: JSON.parse(JSON.stringify(points)),
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
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  const posZ = position?.z ?? 0;
  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation: { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) },
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
  const height = (config.physics as any)?.height ?? 1.5;

  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;

  let rawBody: import('@dimforge/rapier3d-compat').default.RigidBody | undefined;
  let rawCollider: import('@dimforge/rapier3d-compat').default.Collider | undefined;

  if (physics.driver && physics.driver.isReady) {
    const pos3D = { x: posX, y: posY, z: posZ };
    rawBody = physics.driver.createFixedBody(pos3D, id);
    rawBody.setRotation({ x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) }, false);

    // Смещаем коллайдер вверх на hy, чтобы основание стояло на плоскости Y=0
    rawCollider = physics.driver.createCuboidCollider(hx, hy, hz, rawBody, 0, hy);
  }
  world.addComponent(id, 'physicsBody', {
    rawBody,
    rawCollider,
    bodyType: 'fixed',
    isStatic: true,
    category,
    mask,
  });

  // 7. Компонент видимости
  world.addComponent(id, 'renderable', {
    zIndex: RENDER_Z_INDEX.OBSTACLES,
    isVisible: true,
    syncWithTransform: true,
  });
}
