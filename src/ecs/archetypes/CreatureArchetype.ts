import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';
import { createStat } from '../stats/StatEvaluator';

export function assembleCreature(
  world: World,
  _physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
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

  // 4. Передвижение
  const maxSpeed = config.movement?.maxSpeed ?? 150;
  const maxTurnSpeed = config.movement?.maxTurnSpeed ?? ((Math.PI * 1.5) as Radians);
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
    standToCrouchTime: createStat(config.movement?.standToCrouchTime ?? 0.1),
    crouchToStandTime: createStat(config.movement?.crouchToStandTime ?? 0.1),
    standToProneTime: createStat(config.movement?.standToProneTime ?? 0.5),
    proneToStandTime: createStat(config.movement?.proneToStandTime ?? 1.0),
    crouchToProneTime: createStat(config.movement?.crouchToProneTime ?? 0.5),
    proneToCrouchTime: createStat(config.movement?.proneToCrouchTime ?? 1.0),
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
    world.addComponent(id, 'visualModel', JSON.parse(JSON.stringify(config.visualModel)));
  }

  if (config.animator) {
    world.addComponent(id, 'animator', JSON.parse(JSON.stringify(config.animator)));
  }

  // 8. Трансформация (Базовая координата всего существа)
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  world.addComponent(id, 'transform', { x: posX, y: posY, angle: 0 as Radians });
}
