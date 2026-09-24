import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig, CollisionCategory, COLLISION_MASK_ALL } from '../types';
import { Vec3 } from '../../types';
import { Radians } from '../../utils';
import { createStat } from '../stats/StatEvaluator';
import { BALANCE_CONFIG } from '../../config/balanceConfig';
import { fastClone } from '../utils/clone';

export function assembleCreature(
  world: World,
  physics: PhysicsSystem,
  aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Vec3
): void {
  const behavior = config.ai?.behavior ?? 'IdleTree';

  // 1. Тег абстрактного корня
  world.addComponent(id, 'tag', { archetype: 'creature' });

  // 2. Мета-информация
  world.addComponent(id, 'meta', {
    name: config.meta?.name || 'Существо',
    stance: config.meta?.stance ?? 'standing',
    movementMode: config.meta?.movementMode ?? 'immobile',
    directionMode: config.meta?.directionMode ?? 'immobile',
    actionMode: config.meta?.actionMode ?? 'idle',
    entityType: 'creature',
  });

  // 3. Здоровье (заглушка для предотвращения падения систем)
  world.addComponent(id, 'health', {
    current: 100,
    max: createStat(100),
    isAlive: true,
    destructible: false,
    hitFlashTimer: 0,
    healFlashTimer: 0,
  });

  // 4. Передвижение (в метрической системе)
  const maxSpeed = config.movement?.maxSpeed ?? BALANCE_CONFIG.creature.maxSpeed;
  const maxTurnSpeed = config.movement?.maxTurnSpeed ?? BALANCE_CONFIG.creature.maxTurnSpeed;
  world.addComponent(id, 'movementStats', {
    maxSpeed: createStat(maxSpeed),
    maxTurnSpeed: createStat(maxTurnSpeed),
    runSpeedMultiplier: config.movement?.runSpeedMultiplier ?? 1.5,
    crouchSpeedMultiplier: config.movement?.crouchSpeedMultiplier ?? 0.5,
    proneSpeedMultiplier: config.movement?.proneSpeedMultiplier ?? 0.2,
    walkSpeedMultiplier: config.movement?.walkSpeedMultiplier ?? 0.5,
    runTurnMultiplier: config.movement?.runTurnMultiplier ?? 0.7,
    crouchTurnMultiplier: config.movement?.crouchTurnMultiplier ?? 0.8,
    proneTurnMultiplier: config.movement?.proneTurnMultiplier ?? 0.3,
    walkTurnMultiplier: config.movement?.walkTurnMultiplier ?? 1.1,
    turnInPlaceTurnMultiplier: config.movement?.turnInPlaceTurnMultiplier ?? 1.2,
    strafeSpeedMultiplier: config.movement?.strafeSpeedMultiplier ?? 0.8,
    backwardSpeedMultiplier: config.movement?.backwardSpeedMultiplier ?? 0.6,
    strafeTurnMultiplier: config.movement?.strafeTurnMultiplier ?? 0.8,
    backwardTurnMultiplier: config.movement?.backwardTurnMultiplier ?? 0.6,
    pickupSpeedMultiplier: config.movement?.pickupSpeedMultiplier ?? 0.5,
    pickupTurnMultiplier: config.movement?.pickupTurnMultiplier ?? 1.1,
    standToCrouchTime: createStat(
      config.movement?.standToCrouchTime ?? BALANCE_CONFIG.creature.transitions.standToCrouch
    ),
    crouchToStandTime: createStat(
      config.movement?.crouchToStandTime ?? BALANCE_CONFIG.creature.transitions.crouchToStand
    ),
    standToProneTime: createStat(
      config.movement?.standToProneTime ?? BALANCE_CONFIG.creature.transitions.standToProne
    ),
    proneToStandTime: createStat(
      config.movement?.proneToStandTime ?? BALANCE_CONFIG.creature.transitions.proneToStand
    ),
    crouchToProneTime: createStat(
      config.movement?.crouchToProneTime ?? BALANCE_CONFIG.creature.transitions.crouchToProne
    ),
    proneToCrouchTime: createStat(
      config.movement?.proneToCrouchTime ?? BALANCE_CONFIG.creature.transitions.proneToCrouch
    ),
    dropPrepTime: createStat(
      config.movement?.dropPrepTime ?? BALANCE_CONFIG.creature.transitions.dropPrep
    ),
    dropRecoveryTime: createStat(
      config.movement?.dropRecoveryTime ?? BALANCE_CONFIG.creature.transitions.dropRecovery
    ),
    airborneTurnMultiplier:
      config.movement?.airborneTurnMultiplier ?? BALANCE_CONFIG.creature.airborneTurnMultiplier,
    jumpVelocity: createStat(config.movement?.jumpVelocity ?? BALANCE_CONFIG.creature.jumpVelocity),
    maxJumpSlopeAngle: createStat(
      config.movement?.maxJumpSlopeAngle ?? BALANCE_CONFIG.creature.maxJumpSlopeAngle
    ),
    minSlopeSlideAngle:
      config.movement?.minSlopeSlideAngle ?? BALANCE_CONFIG.creature.minSlopeSlideAngle,
    slopeSlideAcceleration:
      config.movement?.slopeSlideAcceleration ?? BALANCE_CONFIG.creature.slopeSlideAcceleration,
  });

  world.addComponent(id, 'velocity', {
    vx: 0,
    vy: 0,
    vz: 0,
    currentSpeed: 0,
    currentTurnSpeed: 0 as Radians,
    externalVx: 0,
    externalVy: 0,
    externalVz: 0,
    isGrounded: true,
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
    wantsJump: false,
    attackSlotIndex: undefined,
    desiredStance: 'standing',
  });

  // 5. Локальное время
  world.addComponent(id, 'timeScale', { multiplier: createStat(1.0) });

  // 6. Скрытность
  const stealthPower = config.stealth?.stealthPower ?? 10;
  world.addComponent(id, 'stealthStats', {
    stealthPower: createStat(stealthPower),
    runStealthMultiplier: config.stealth?.runStealthMultiplier ?? 0.5,
    crouchStealthMultiplier: config.stealth?.crouchStealthMultiplier ?? 1.5,
    proneStealthMultiplier: config.stealth?.proneStealthMultiplier ?? 3.0,
    walkStealthMultiplier: config.stealth?.walkStealthMultiplier ?? 1.3,
    turnInPlaceStealthMultiplier: config.stealth?.turnInPlaceStealthMultiplier ?? 1.5,
    immobileStealthMultiplier: config.stealth?.immobileStealthMultiplier ?? 2.0,
  });

  // 7. ИИ и поведение
  world.addComponent(id, 'aiStats', {
    behavior: { base: behavior, current: behavior },
    stats: config.ai?.stats,
  });

  world.addComponent(id, 'activeAttacks', { attacks: [] });

  if (config.visualModel) {
    world.addComponent(id, 'visualModel', fastClone(config.visualModel));
  }

  if (config.animator) {
    world.addComponent(id, 'animator', fastClone(config.animator));
  }

  // 8. Трансформация (Базовая координата всего существа в 3D)
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  const posZ = position?.z ?? 0;
  world.addComponent(id, 'transform', {
    x: posX,
    y: posY,
    z: posZ,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    angle: 0 as Radians,
  });

  // 9. Физические свойства и тело коллизии
  const radius = config.physics?.radius ?? BALANCE_CONFIG.creature.radius;
  const weight = config.physics?.weight ?? BALANCE_CONFIG.creature.weight;
  const isSolid = config.physics?.isSolid ?? true;

  world.addComponent(id, 'physicsStats', {
    radius: createStat(radius),
    weight: createStat(weight),
    isSolid,
  });

  if (physics) {
    world.addComponent(id, 'physicsBody', {
      isStatic: false,
      category: CollisionCategory.CREATURE,
      mask: COLLISION_MASK_ALL,
      currentColliderStance: config.meta?.stance ?? 'standing',
    });
  }

  // 10. Компонент видимости
  world.addComponent(id, 'renderable', {
    zIndex: 40,
    isVisible: config.renderable?.isVisible ?? true,
    syncWithTransform: true,
  });

  // 11. Органы чувств
  if (config.perception) {
    world.addComponent(id, 'perception', fastClone(config.perception));
  }

  // 12. Инициализация логического мозга ИИ
  if (aiSystem) {
    aiSystem.initBotBrain(world, id, behavior);
  }
}
