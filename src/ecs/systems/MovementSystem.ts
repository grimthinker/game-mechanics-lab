import { Radians } from '../../utils';
import { World } from '../World';
import { ModifierType } from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';
import { GAMEPLAY_CONFIG } from '../../gameplayConfig';

export class MovementSystem {
  public update(dt: number, world: World): void {
    const entities = world.getEntitiesWith(
      'transform',
      'velocity',
      'input',
      'health',
      'activeAttacks',
      'meta',
      'movementStats'
    );

    for (const [
      id,
      { transform, velocity, input, health, activeAttacks, meta, movementStats },
    ] of entities) {
      if (!health.isAlive || health.current <= 0) {
        if (velocity.currentSpeed !== 0 || velocity.currentTurnSpeed !== 0) {
          velocity.currentSpeed = 0;
          velocity.currentTurnSpeed = 0 as Radians;
        }
        continue;
      }

      // 1. Модификаторы состояний бега и присяда
      if (input.isRunning) {
        addModifier(movementStats.maxSpeed, {
          id: 'state_run_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.runSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'state_crouch_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'state_run_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.runTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'state_crouch_turn');
      } else if (input.isCrouching) {
        addModifier(movementStats.maxSpeed, {
          id: 'state_crouch_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.crouchSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'state_run_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'state_crouch_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.crouchTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'state_run_turn');
      } else {
        removeModifier(movementStats.maxSpeed, 'state_run_speed');
        removeModifier(movementStats.maxSpeed, 'state_crouch_speed');
        removeModifier(movementStats.maxTurnSpeed, 'state_run_turn');
        removeModifier(movementStats.maxTurnSpeed, 'state_crouch_turn');
      }

      // 2. Модификаторы замедления от активных атак оружия
      let moveSlow = 1;
      let turnSlow = 1;
      for (const atk of activeAttacks.attacks) {
        const wStats = world.getComponent(atk.weaponId, 'weaponStats');
        if (!wStats) continue;

        let mMove = 1;
        let mTurn = 1;

        if (atk.phase === 'prep') {
          mMove = wStats.prepMoveSlow;
          mTurn = wStats.prepTurnSlow;
        } else if (atk.phase === 'cast') {
          mMove = wStats.castMoveSlow;
          mTurn = 0;
        } else {
          mMove = wStats.recoveryMoveSlow;
          mTurn = wStats.recoveryTurnSlow;
        }

        if (mMove < moveSlow) moveSlow = mMove;
        if (mTurn < turnSlow) turnSlow = mTurn;
      }

      if (moveSlow < 1) {
        addModifier(movementStats.maxSpeed, {
          id: 'attack_slow_move',
          type: ModifierType.PERCENT_MULT,
          value: moveSlow,
        });
      } else {
        removeModifier(movementStats.maxSpeed, 'attack_slow_move');
      }

      if (turnSlow < 1) {
        addModifier(movementStats.maxTurnSpeed as any, {
          id: 'attack_slow_turn',
          type: ModifierType.PERCENT_MULT,
          value: turnSlow,
        });
      } else {
        removeModifier(movementStats.maxTurnSpeed as any, 'attack_slow_turn');
      }

      // 3. Линейная скорость с плавным разгоном и торможением за заданное время из конфига
      const targetSpeed = input.isMovingForward ? movementStats.maxSpeed.current : 0;
      const maxSpd = movementStats.maxSpeed.current > 0 ? movementStats.maxSpeed.current : 1;

      if (velocity.currentSpeed < targetSpeed) {
        const accelRate = maxSpd / GAMEPLAY_CONFIG.accelerationTime;
        velocity.currentSpeed = Math.min(targetSpeed, velocity.currentSpeed + accelRate * dt);
      } else if (velocity.currentSpeed > targetSpeed) {
        const decelRate = maxSpd / GAMEPLAY_CONFIG.decelerationTime;
        velocity.currentSpeed = Math.max(targetSpeed, velocity.currentSpeed - decelRate * dt);
      }

      // 4. Скорость поворота (вычисляется из актуального максимума и намерения ввода turnRatio)
      const turnSpeed = movementStats.maxTurnSpeed.current * input.turnRatio;
      velocity.currentTurnSpeed = (input.turnDirection * turnSpeed) as Radians;

      // 5. Поворот
      if (velocity.currentTurnSpeed !== 0) {
        transform.angle = (transform.angle + velocity.currentTurnSpeed * dt) as Radians;
      }

      // 6. Обновление состояния сущности
      if (activeAttacks.attacks.length > 0) {
        meta.state = 'attacking';
      } else if (input.isRunning && (input.isMovingForward || input.turnDirection !== 0)) {
        meta.state = 'running';
      } else if (input.isCrouching && (input.isMovingForward || input.turnDirection !== 0)) {
        meta.state = 'crouching';
      } else if (input.isMovingForward || input.turnDirection !== 0) {
        meta.state = 'moving';
      } else {
        meta.state = 'idle';
      }
    }
  }
}
