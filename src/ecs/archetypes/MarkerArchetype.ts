import { Circle } from 'detect-collisions';
import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import {
  EntityId,
  EntityConfig,
  RENDER_Z_INDEX,
  RenderableComponent,
  CollisionCategory,
  COLLISION_MASK_NONE,
} from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';

export function assembleMarker(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
): void {
  const gizmo = config.gizmo ?? {
    type: 'marker',
    color: '#9b59b6',
    icon: '📍',
    radius: 14,
  };

  const radius = gizmo.radius ?? 14;
  const color = gizmo.color ?? '#9b59b6';
  const icon = gizmo.icon ?? '📍';
  const name = config.meta?.name ?? gizmo.type;

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'marker', subType: gizmo.type });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name,
    entityType: 'marker',
  });

  // 3. Компонент гизмо
  world.addComponent(id, 'gizmo', gizmo);

  // 4. Трансформация и физическое тело-сенсор для выборки в check2d
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = true;
  world.addComponent(id, 'physicsBody', {
    body,
    isStatic: true,
    category: CollisionCategory.NONE,
    mask: COLLISION_MASK_NONE,
    isTrigger: true,
  });
  physics.registerBody(id, body);

  // 5. Универсальный компонент отрисовки (Renderable)
  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.GIZMOS,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'circle',
        radius,
        fill: 'rgba(155, 89, 182, 0.15)',
        stroke: color,
        strokeWidth: 1.5,
        dash: [4, 4],
      },
      {
        kind: 'text',
        text: icon,
        font: '14px sans-serif',
        fill: '#ffffff',
        ignoreRotation: true,
        align: 'center',
        baseline: 'middle',
      },
      {
        kind: 'text',
        text: name,
        offset: { x: 0, y: radius + 4 },
        font: '10px sans-serif',
        fill: '#bbbbbb',
        ignoreRotation: true,
        align: 'center',
        baseline: 'top',
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
