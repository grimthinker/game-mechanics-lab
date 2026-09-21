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
import { Point, Vec3 } from '../../types';
import { Radians } from '../../utils';

export function assembleMarker(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point | Vec3
): void {
  const gizmo = config.gizmo ?? {
    type: 'marker',
    color: '#9b59b6',
    icon: '📍',
    radius: 0.4,
  };

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

  // 4. Трансформация и физическое тело-сенсор для выборки в 3D
  const posX = position?.x ?? 0;
  const hasZ = position && 'z' in position;
  const posY = hasZ ? (position as Vec3).y : 0;
  const posZ = hasZ ? (position as Vec3).z : (position?.y ?? 0);
  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    angle: 0 as Radians,
  });

  world.addComponent(id, 'physicsBody', {
    isStatic: true,
    category: CollisionCategory.NONE,
    mask: COLLISION_MASK_NONE,
    isTrigger: true,
  });

  // 5. Компонент видимости
  world.addComponent(id, 'renderable', {
    zIndex: RENDER_Z_INDEX.GIZMOS,
    isVisible: true,
    syncWithTransform: true,
  });
}
