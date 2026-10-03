import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import {
  EntityId,
  EntityConfig,
  ItemData,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  RENDER_Z_INDEX,
  RenderableComponent,
} from '../types';
import { Vec3 } from '../../types';
import { Radians } from '../../utils';
import { createStat } from '../stats/StatEvaluator';
import { BALANCE_CONFIG } from '../../config/balanceConfig';
import { fastClone } from '../utils/clone';

export function assembleItem(
  world: World,
  physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Vec3
): void {
  const itemData: ItemData = {
    name: config.item?.name ?? 'Предмет',
    type: config.item?.type ?? 'weapon',
    maxStack: config.item?.maxStack ?? 1,
    count: config.item?.count ?? 1,
    size: config.item?.size ?? 10,
    equipTypes: config.item?.equipTypes ?? [],
    equippable: config.item?.equippable ?? false,
    equipTimeMultiplier: config.item?.equipTimeMultiplier ?? 1.0,
  };
  const radius = config.physics?.radius ?? BALANCE_CONFIG.items.defaultRadius;
  const weight = config.physics?.weight ?? BALANCE_CONFIG.items.defaultWeight;
  const isSolid = config.physics?.isSolid ?? true;

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'item', subType: itemData.type });

  // 2. Базовые данные предмета
  world.addComponent(id, 'item', itemData);

  // 3. Мета-информация
  world.addComponent(id, 'meta', {
    name: itemData.name,
    entityType: 'item',
  });

  // 4. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    height: createStat(config.physics?.height ?? radius * 2),
    weight: createStat(weight),
    isSolid,
    shape: config.physics?.shape,
    restitution: config.physics?.restitution,
    friction: config.physics?.friction,
    linearDamping: config.physics?.linearDamping,
    angularDamping: config.physics?.angularDamping,
    halfExtents: config.physics?.halfExtents ? { ...config.physics.halfExtents } : undefined,
    colliderOffset: config.physics?.colliderOffset
      ? { ...config.physics.colliderOffset }
      : undefined,
  });

  // 4.5. Принадлежность (если предмет экипирован или находится в инвентаре)
  if (config.ownership) {
    world.addComponent(id, 'ownership', config.ownership);
  }

  if (config.fetchStick) {
    world.addComponent(id, 'fetchStick', { ...config.fetchStick });
  }

  // 4.6. Здоровье (Структурная прочность)
  const maxHp = config.health?.maxHp ?? BALANCE_CONFIG.items.defaultMaxHp;
  world.addComponent(id, 'health', {
    current: config.health?.hp ?? maxHp,
    max: createStat(maxHp),
    isAlive: true,
    destructible: config.health?.destructible ?? true,
    hitFlashTimer: 0,
    healFlashTimer: 0,
  });

  // 4.7. Локальный масштаб времени
  world.addComponent(id, 'timeScale', { multiplier: createStat(1.0) });

  const isPossessed = !!config.ownership;

  // 5. Специфические компоненты экипировки
  if (itemData.type === 'weapon') {
    const ws = config.weaponStats ?? {};
    const wd = BALANCE_CONFIG.items.weapon;
    world.addComponent(id, 'weaponStats', {
      baseDamage: createStat(ws.baseDamage ?? wd.baseDamage),
      prepTime: createStat(ws.prepTime ?? wd.prepTime),
      castTime: createStat(ws.castTime ?? wd.castTime),
      recoveryTime: createStat(ws.recoveryTime ?? wd.recoveryTime),
      prepTurnSlow: ws.prepTurnSlow ?? wd.prepTurnSlow,
      recoveryTurnSlow: ws.recoveryTurnSlow ?? wd.recoveryTurnSlow,
      prepMoveSlow: ws.prepMoveSlow ?? wd.prepMoveSlow,
      recoveryMoveSlow: ws.recoveryMoveSlow ?? wd.recoveryMoveSlow,
      castMoveSlow: ws.castMoveSlow ?? wd.castMoveSlow,
      minMultiplier: ws.minMultiplier ?? 0.8,
      maxMultiplier: ws.maxMultiplier ?? 1.2,
      critChance: ws.critChance ?? 0.1,
      critMultiplier: ws.critMultiplier ?? 2.0,
    });

    if (config.weaponZone) {
      world.addComponent(id, 'weaponZone', fastClone(config.weaponZone));
    }
  } else if (itemData.type === 'armor') {
    const as = config.armorStats ?? {};
    world.addComponent(id, 'armorStats', {
      defense: createStat(as.defense ?? 0),
      flatReduction: createStat(as.flatReduction ?? 0),
    });
  }

  // 5.1. Наличие встроенного инвентаря (сумка или карманы на броне/предмете)
  if (config.inventory || itemData.type === 'bag') {
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

  // 5.2. Наличие собственных областей экипировки у предмета (пояс, разгрузка, подвес)
  if (config.equip && config.equip.equipmentAreas && config.equip.equipmentAreas.length > 0) {
    world.addComponent(id, 'equip', {
      equipmentAreas: fastClone(config.equip.equipmentAreas),
    });
  }

  // 6. Трансформация и физическое тело на карте в 3D
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0.2;
  const posZ = position?.z ?? 0;
  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    angle: 0 as Radians,
  });

  if (!isPossessed) {
    physics.createDynamicItemBody(world, id, { x: posX, y: posY, z: posZ });
  }

  // 7. Компонент видимости и визуальная модель
  if (config.visualModel) {
    world.addComponent(id, 'visualModel', fastClone(config.visualModel));
  }

  world.addComponent(id, 'renderable', {
    zIndex: RENDER_Z_INDEX.ITEMS,
    isVisible: !isPossessed,
    syncWithTransform: true,
  });

  // 8. Интерактивность предмета
  world.addComponent(id, 'interactable', {
    options: [
      { id: 'inspect', verb: 'inspect', label: 'Осмотреть', icon: '🔍' },
      { id: 'take', verb: 'take', label: 'Взять', icon: '✋' },
      { id: 'push', verb: 'push', label: 'Толкнуть', icon: '🦶' },
    ],
    defaultVerb: 'take',
    interactDistance: 2.0,
  });
}
