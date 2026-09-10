import { Polygon } from 'detect-collisions';
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
  position?: Point
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
    hitFlashTimer: 0,
    healFlashTimer: 0,
    healthBarTimer: 0,
  });

  // 5. Трансформация
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle });

  // 6. Статичное физическое тело Polygon
  const body = new Polygon({ x: posX, y: posY }, points);
  body.setAngle(angle);
  body.isStatic = true;
  const category = CollisionCategory.OBSTACLE;
  const mask = isSolid && hp > 0 ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

  world.addComponent(id, 'physicsBody', {
    body,
    isStatic: true,
    category,
    mask,
  });
  physics.registerBody(id, body);

  // 7. Универсальный компонент отрисовки
  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.OBSTACLES,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'polygon',
        points: JSON.parse(JSON.stringify(points)),
        fill: '#555555',
        stroke: '#777777',
        strokeWidth: 2,
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
