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
  EquipmentComponent,
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
    stance: config.meta?.stance ?? 'standing',
    movementMode: config.meta?.movementMode ?? 'immobile',
    directionMode: config.meta?.directionMode ?? 'immobile',
    actionMode: config.meta?.actionMode ?? 'idle',
    entityType: config.meta?.entityType || 'creature',
  });

  // 3. Физические характеристики
  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    weight: createStat(weight),
    isSolid,
  });

  // 3.5. Локальное время
  world.addComponent(id, 'timeScale', {
    multiplier: createStat(1.0),
  });

  // 4. Здоровье
  world.addComponent(id, 'health', {
    current: hp,
    max: createStat(maxHp),
    isAlive: hp > 0,
    hitFlashTimer: 0,
    healFlashTimer: 0,
    healthBarTimer: 0,
  });

  // 4.5. Собственная броня существа
  const armorConfig = config.armorStats ?? {};
  world.addComponent(id, 'armorStats', {
    defense: createStat(armorConfig.defense ?? 0),
    flatReduction: createStat(armorConfig.flatReduction ?? 0),
  });

  // 5. Передвижение
  const maxSpeed = config.movement?.maxSpeed ?? 150;
  const maxTurnSpeed = config.movement?.maxTurnSpeed ?? ((Math.PI * 1.5) as Radians);
  world.addComponent(id, 'movementStats', {
    maxSpeed: createStat(maxSpeed),
    maxTurnSpeed: createStat(maxTurnSpeed),
    runSpeedMultiplier: config.movement?.runSpeedMultiplier ?? 1.5,
    crouchSpeedMultiplier: config.movement?.crouchSpeedMultiplier ?? 0.5,
    walkSpeedMultiplier: config.movement?.walkSpeedMultiplier ?? 0.5,
    runTurnMultiplier: config.movement?.runTurnMultiplier ?? 0.8,
    crouchTurnMultiplier: config.movement?.crouchTurnMultiplier ?? 0.8,
    strafeSpeedMultiplier: config.movement?.strafeSpeedMultiplier ?? 0.8,
    backwardSpeedMultiplier: config.movement?.backwardSpeedMultiplier ?? 0.6,
    strafeTurnMultiplier: config.movement?.strafeTurnMultiplier ?? 0.8,
    backwardTurnMultiplier: config.movement?.backwardTurnMultiplier ?? 0.6,
    pickupSpeedMultiplier: config.movement?.pickupSpeedMultiplier ?? 0.5,
    pickupTurnMultiplier: config.movement?.pickupTurnMultiplier ?? 1.1,
  });
  world.addComponent(id, 'velocity', {
    vx: 0,
    vy: 0,
    currentSpeed: 0,
    currentTurnSpeed: 0 as Radians,
    externalVx: 0,
    externalVy: 0,
  });
  world.addComponent(id, 'input', {
    desiredMoveVector: null,
    moveForward: 0,
    moveStrafe: 0,
    targetLookAngle: undefined,
    isMovingForward: false,
    turnDirection: 0,
    turnRatio: 0,
    isRunning: false,
    isCrouching: false,
    isSlowWalking: false,
    wantsAttack: false,
    attackSlotIndex: undefined,
  });

  // 6. Скрытность
  const stealthPower = config.stealth?.stealthPower ?? 10;
  world.addComponent(id, 'stealthStats', {
    stealthPower: createStat(stealthPower),
    runStealthMultiplier: config.stealth?.runStealthMultiplier ?? 0.5,
    crouchStealthMultiplier: config.stealth?.crouchStealthMultiplier ?? 1.5,
    walkStealthMultiplier: config.stealth?.walkStealthMultiplier ?? 1.3,
    turnInPlaceStealthMultiplier: config.stealth?.turnInPlaceStealthMultiplier ?? 1.5,
    immobileStealthMultiplier: config.stealth?.immobileStealthMultiplier ?? 2.0,
  });

  // 7. ИИ и поведение
  world.addComponent(id, 'aiStats', {
    behavior: { base: behavior, current: behavior },
    stats: config.ai?.stats,
  });
  aiSystem.initBotBrain(world, id, behavior);

  // 8. Экипировка и атаки
  const equipComp: EquipmentComponent = config.equip
    ? JSON.parse(JSON.stringify(config.equip))
    : {
        interactionSlots: [
          { id: 'hand_left', interactDist: 25, strength: 11, itemId: null },
          { id: 'hand_right', interactDist: 25, strength: 11, itemId: null },
        ],
        equipmentAreas: [
          { id: 'head', name: 'Голова', type: 'head', space: 10, itemIds: [] },
          { id: 'neck', name: 'Шея', type: 'neck', space: 10, itemIds: [] },
          { id: 'torso', name: 'Туловище', type: 'torso', space: 40, itemIds: [] },
          { id: 'hands_1', name: 'Рука (кольца)', type: 'hands', space: 10, itemIds: [] },
          { id: 'hands_2', name: 'Рука (браслеты)', type: 'hands', space: 10, itemIds: [] },
          { id: 'legs', name: 'Ноги', type: 'legs', space: 20, itemIds: [] },
          { id: 'feet_1', name: 'Ступня левая', type: 'feet', space: 10, itemIds: [] },
          { id: 'feet_2', name: 'Ступня правая', type: 'feet', space: 10, itemIds: [] },
        ],
      };

  world.addComponent(id, 'equip', equipComp);
  world.addComponent(id, 'activeAttacks', { attacks: [] });

  // 9. Трансформация и физическое тело
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });

  const body = new Circle({ x: posX, y: posY }, radius);
  body.isStatic = false;
  const category = CollisionCategory.CREATURE;
  const mask = isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
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
      // Треугольная стрелка направления взгляда
      {
        kind: 'polygon',
        points: [
          { x: radius, y: 0 },
          { x: 0, y: -radius },
          { x: 0, y: radius },
        ],
        fill: '#7f8c8d',
        stroke: '#95a5a6',
        strokeWidth: 1.5,
      },
    ],
  };
  world.addComponent(id, 'renderable', renderable);
}
