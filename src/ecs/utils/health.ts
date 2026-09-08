import { World } from '../World';
import { EntityId } from '../types';
import { Radians } from '../../utils';
import { removeModifier } from '../stats/StatEvaluator';

/**
 * Немедленно переводит сущность в состояние смерти с очисткой всех активных действий,
 * скоростей и модификаторов передвижения.
 */
export function killEntity(world: World, id: EntityId): void {
  const health = world.getComponent(id, 'health');
  if (health) {
    health.isAlive = false;
    health.current = 0;
  }

  const input = world.getComponent(id, 'input');
  if (input) {
    input.desiredMoveVector = null;
    input.moveForward = 0;
    input.moveStrafe = 0;
    input.targetLookAngle = undefined;
    input.isMovingForward = false;
    input.turnDirection = 0;
    input.turnRatio = 0;
    input.isRunning = false;
    input.isCrouching = false;
    input.isSlowWalking = false;
    input.wantsAttack = false;
    input.attackSlotIndex = undefined;
  }

  const velocity = world.getComponent(id, 'velocity');
  if (velocity) {
    velocity.vx = 0;
    velocity.vy = 0;
    velocity.currentSpeed = 0;
    velocity.currentTurnSpeed = 0 as Radians;
  }

  const movementStats = world.getComponent(id, 'movementStats');
  if (movementStats) {
    removeModifier(movementStats.maxSpeed, 'state_run_speed');
    removeModifier(movementStats.maxSpeed, 'state_crouch_speed');
    removeModifier(movementStats.maxSpeed, 'attack_slow_move');
    removeModifier(movementStats.maxTurnSpeed, 'state_run_turn');
    removeModifier(movementStats.maxTurnSpeed, 'state_crouch_turn');
    removeModifier(movementStats.maxTurnSpeed, 'attack_slow_turn');
  }

  const activeAttacks = world.getComponent(id, 'activeAttacks');
  if (activeAttacks) {
    activeAttacks.attacks = [];
  }

  const meta = world.getComponent(id, 'meta');
  if (meta) {
    meta.movementMode = 'dead';
    meta.directionMode = 'immobile';
  }
}

/**
 * Наносит урон сущности. Если урон летальный — сразу вызывает killEntity.
 */
export function applyDamage(
  world: World,
  id: EntityId,
  amount: number,
  triggerFlash: boolean = true
): void {
  const health = world.getComponent(id, 'health');
  if (!health || !health.isAlive) return;

  const nextHp = Math.max(0, health.current - amount);
  health.current = Math.round(nextHp * 100) / 100;

  if (triggerFlash) {
    health.hitFlashTimer = 0.2;
  }

  if (health.current <= 0) {
    killEntity(world, id);
  }
}

/**
 * Восстанавливает здоровье живой сущности до предела максимального HP.
 */
export function applyHeal(
  world: World,
  id: EntityId,
  amount: number,
  triggerFlash: boolean = true
): void {
  const health = world.getComponent(id, 'health');
  if (!health || !health.isAlive) return;

  if (health.current < health.max.current) {
    const nextHp = Math.min(health.max.current, health.current + amount);
    health.current = Math.round(nextHp * 100) / 100;
    if (triggerFlash) {
      health.healFlashTimer = 0.2;
    }
  }
}
