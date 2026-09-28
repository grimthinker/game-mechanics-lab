import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import {
  EntityId,
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  RENDER_Z_INDEX,
} from '../types';
import { Vec3 } from '../../types';
import { WaterComponent, WaterConfig } from '../components/water';
import { createStat } from '../stats/StatEvaluator';
import { createRectanglePoints } from '../../utils';

export function createWaterConfig(
  waterType: 'lake' | 'river' = 'lake',
  width: number = 20,
  depth: number = 20,
  name?: string,
  options?: Partial<WaterConfig>
): EntityConfig {
  const isRiver = waterType === 'river';
  const defaultName = name || (isRiver ? 'Река' : 'Озеро');

  const waterComp: WaterComponent = {
    width,
    depth,
    waterType,
    color: options?.color ?? (isRiver ? '#1abc9c' : '#2980b9'),
    opacity: options?.opacity ?? 0.8,
    waveSpeed: options?.waveSpeed ?? (isRiver ? 2.5 : 1.2),
    waveHeight: options?.waveHeight ?? (isRiver ? 0.08 : 0.12),
    flowDirection: options?.flowDirection ?? (isRiver ? { x: 0, z: 1 } : { x: 0, z: 0 }),
    flowSpeed: options?.flowSpeed ?? (isRiver ? 2.0 : 0.0),
    density: options?.density ?? 1000,
    viscosity: options?.viscosity ?? 1.5,
  };

  return {
    tag: { archetype: 'water', subType: waterType },
    meta: {
      name: defaultName,
      entityType: 'water',
      destructible: false,
    },
    water: waterComp,
    physics: {
      radius: Math.max(width, depth) / 2,
      height: 2.0,
      weight: 100000,
      isSolid: false,
      points: createRectanglePoints(width, depth),
    },
    renderable: {
      zIndex: RENDER_Z_INDEX.ZONES + 1,
      isVisible: true,
      syncWithTransform: true,
    },
  };
}

export function assembleWater(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Vec3
): void {
  const waterComp: WaterComponent = config.water
    ? ({ ...config.water } as WaterComponent)
    : {
        width: 20,
        depth: 20,
        waterType: 'lake',
        color: '#2980b9',
        opacity: 0.8,
        waveSpeed: 1.2,
        waveHeight: 0.12,
        flowDirection: { x: 0, z: 0 },
        flowSpeed: 0.0,
        density: 1000,
        viscosity: 1.5,
      };

  const width = waterComp.width;
  const depth = waterComp.depth;
  const radius = Math.max(width, depth) / 2;

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'water', subType: waterComp.waterType });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name: config.meta?.name || (waterComp.waterType === 'river' ? 'Река' : 'Озеро'),
    entityType: 'water',
    destructible: false,
  });

  // 3. Компонент воды
  world.addComponent(id, 'water', waterComp);

  // 4. Физические характеристики сенсорного объема
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    height: createStat(2.0),
    weight: createStat(100000),
    isSolid: false,
    points: createRectanglePoints(width, depth),
  });

  // 5. Трансформация в 3D
  const posX = position?.x ?? config.transform?.x ?? 0;
  const posY = position?.y ?? config.transform?.y ?? 0;
  const posZ = position?.z ?? config.transform?.z ?? 0;

  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    angle: 0,
  });

  // 6. Физическое тело-сенсор в Rapier3D (Trigger Volume)
  const category = CollisionCategory.TRIGGER_ZONE;
  const mask = CollisionCategory.CREATURE | CollisionCategory.ITEM;

  let rawBody: any = undefined;
  let rawCollider: any = undefined;

  if (physics.driver && physics.driver.isReady) {
    const pos3D = { x: posX, y: posY, z: posZ };
    rawBody = physics.driver.createFixedBody(pos3D, id);
    const hx = width / 2;
    const hz = depth / 2;
    const hy = 1.0; // Глубина сенсорной зоны под уровнем глади воды (2м общий охват)
    rawCollider = physics.driver.createCuboidCollider(hx, hy, hz, rawBody, 0, {
      x: 0,
      y: -hy,
      z: 0,
    });
    if (rawCollider) {
      rawCollider.setSensor(true);
    }
  }

  world.addComponent(id, 'physicsBody', {
    rawBody,
    rawCollider,
    bodyType: 'fixed',
    isStatic: true,
    category,
    mask,
    isTrigger: true,
  });

  // 7. Компонент видимости
  world.addComponent(id, 'renderable', {
    zIndex: RENDER_Z_INDEX.ZONES + 1,
    isVisible: true,
    syncWithTransform: true,
  });
}
