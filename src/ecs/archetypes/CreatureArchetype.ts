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
  isValidStandardRadius,
} from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';
import { createStat } from '../stats/StatEvaluator';

export function assembleCreature(
  world: World,
  physics: PhysicsSystem,
  aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
): void {
  const behavior = config.ai?.behavior ?? 'IdleTree';
  const rawRadius = config.physics?.radius ?? 16;
  const radius = isValidStandardRadius(rawRadius) ? rawRadius : 16;
  const weight = config.physics?.weight ?? 10;
  const isSolid = config.physics?.isSolid ?? true;
  const maxHp = config.health?.maxHp ?? 100;
  const hp = config.health?.hp ?? maxHp;

  // 1. Тег архетипа
  world.addComponent(id, 'tag', { archetype: 'creature' });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name: config.meta?.name || id,
    state: 'idle',
    entityType: config.meta?.entityType || 'creature',
  });

  // 3. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    weight: createStat(weight),
    isSolid,
  });

  // 4. Здоровье
  world.addComponent(id, 'health', {
    current: hp,
    max: createStat(maxHp),
    isAlive: hp > 0,
    hitFlashTimer: 0,
    healFlashTimer: 0,
  });

  // 5. Передвижение
  const maxSpeed = config.movement?.maxSpeed ?? 150;
  const maxTurnSpeed = config.movement?.maxTurnSpeed ?? ((Math.PI * 1.5) as Radians);
  world.addComponent(id, 'movementStats', {
    maxSpeed: createStat(maxSpeed),
    maxTurnSpeed: createStat(maxTurnSpeed) as any,
    runSpeedMultiplier: config.movement?.runSpeedMultiplier ?? 1.5,
    crouchSpeedMultiplier: config.movement?.crouchSpeedMultiplier ?? 0.5,
    runTurnMultiplier: config.movement?.runTurnMultiplier ?? 0.8,
    crouchTurnMultiplier: config.movement?.crouchTurnMultiplier ?? 1.2,
  });
  world.addComponent(id, 'velocity', {
    currentSpeed: 0,
    currentTurnSpeed: 0 as Radians,
    externalVx: 0,
    externalVy: 0,
  });
  world.addComponent(id, 'input', {
    isMovingForward: false,
    turnDirection: 0,
    turnRatio: 0,
    isRunning: false,
    isCrouching: false,
    wantsAttack: false,
    attackSlotIndex: undefined,
  });

  // 6. Скрытность
  const stealthPower = config.stealth?.stealthPower ?? 10;
  world.addComponent(id, 'stealthStats', {
    stealthPower: createStat(stealthPower),
    runStealthMultiplier: config.stealth?.runStealthMultiplier ?? 0.5,
    crouchStealthMultiplier: config.stealth?.crouchStealthMultiplier ?? 1.5,
  });

  // 7. ИИ и поведение
  world.addComponent(id, 'aiStats', {
    behavior: { base: behavior, current: behavior },
    stats: config.ai?.stats,
  });
  aiSystem.initBotBrain(world, id, behavior);

  // 8. Экипировка и атаки
  const equipSlots = config.equip ?? [
    { type: 'armor', itemId: null },
    { type: 'bag', itemId: null },
    { type: 'weapon', itemId: null },
  ];
  world.addComponent(id, 'equip', { slots: equipSlots });
  world.addComponent(id, 'activeAttacks', { attacks: [] });

  // 9. Трансформация и физическое тело
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = false;
  const category = CollisionCategory.CREATURE;
  const mask = isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
  (body as any).category = category;
  (body as any).mask = mask;
  world.addComponent(id, 'physicsBody', { body, isStatic: false, category, mask });
  physics.registerBody(id, body);

  // 10. Универсальный компонент отрисовки (Renderable)
  const borderColor = behavior === 'PlayerTree' ? '#2980b9' : '#c0392b';
  const renderable: RenderableComponent = {
    zIndex: RENDER_Z_INDEX.CREATURES,
    isVisible: true,
    syncWithTransform: true,
    primitives: [
      {
        kind: 'circle',
        radius,
        fill: '#34495e',
        stroke: borderColor,
        strokeWidth: 2,
      },
      // Стрелка направления взгляда
      {
        kind: 'line',
        from: { x: radius, y: 0 },
        to: { x: 0, y: -radius },
        stroke: '#f1c40f',
        strokeWidth: 2,
      },
      {
        kind: 'line',
        from: { x: radius, y: 0 },
        to: { x: 0, y: radius },
        stroke: '#f1c40f',
        strokeWidth: 2,
      },
      {
        kind: 'line',
        from: { x: 0, y: radius },
        to: { x: 0, y: -radius },
        stroke: '#f1c40f',
        strokeWidth: 2,
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
