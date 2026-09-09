import { Radians } from '../../utils';
import { World } from '../World';
import {
  CreatureDirectionMode,
  CreatureMovementMode,
  CreatureStance,
  ModifierType,
} from '../types';
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
      if (!health.isAlive) {
        if (
          velocity.vx !== 0 ||
          velocity.vy !== 0 ||
          velocity.currentSpeed !== 0 ||
          velocity.currentTurnSpeed !== 0
        ) {
          velocity.vx = 0;
          velocity.vy = 0;
          velocity.currentSpeed = 0;
          velocity.currentTurnSpeed = 0 as Radians;
        }
        removeModifier(movementStats.maxSpeed, 'stance_crouch_speed');
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');
        removeModifier(movementStats.maxSpeed, 'attack_slow_move');
        removeModifier(movementStats.maxSpeed, 'dir_strafe_speed');
        removeModifier(movementStats.maxSpeed, 'dir_back_speed');
        removeModifier(movementStats.maxTurnSpeed, 'stance_crouch_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
        removeModifier(movementStats.maxTurnSpeed, 'attack_slow_turn');
        removeModifier(movementStats.maxTurnSpeed, 'dir_strafe_turn');
        removeModifier(movementStats.maxTurnSpeed, 'dir_back_turn');
        meta.directionMode = 'immobile';
        continue;
      }

      const interactionAction = world.getComponent(id, 'interactionAction');
      if (interactionAction) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
        input.isRunning = false;
        input.wantsAttack = false;

        if (
          interactionAction.type === 'pickup' &&
          (interactionAction.phase === 'reach' || interactionAction.phase === 'abort_reach') &&
          interactionAction.targetItemPos
        ) {
          const dx = interactionAction.targetItemPos.x - transform.x;
          const dy = interactionAction.targetItemPos.y - transform.y;
          if (Math.hypot(dx, dy) > 0.001) {
            input.targetLookAngle = Math.atan2(dy, dx) as Radians;
            input.turnDirection = 0;
            input.turnRatio = 0;
          }
        }
      }

      // 1. Положение существа (Stance)
      const stance: CreatureStance = input.isCrouching ? 'crouching' : 'standing';

      if (stance === 'crouching') {
        addModifier(movementStats.maxSpeed, {
          id: 'stance_crouch_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.crouchSpeedMultiplier,
        });
        addModifier(movementStats.maxTurnSpeed, {
          id: 'stance_crouch_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.crouchTurnMultiplier,
        });
      } else {
        removeModifier(movementStats.maxSpeed, 'stance_crouch_speed');
        removeModifier(movementStats.maxTurnSpeed, 'stance_crouch_turn');
      }

      // 2. Поворот корпуса / взгляда существа (независимо от вектора движения)
      if (input.targetLookAngle !== undefined) {
        let diff = input.targetLookAngle - transform.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const maxTurnStep = movementStats.maxTurnSpeed.current * dt;

        if (Math.abs(diff) <= maxTurnStep) {
          transform.angle = input.targetLookAngle;
          velocity.currentTurnSpeed = (diff / dt) as Radians;
        } else {
          const sign = Math.sign(diff) as -1 | 1;
          transform.angle = (transform.angle + sign * maxTurnStep) as Radians;
          velocity.currentTurnSpeed = (sign * movementStats.maxTurnSpeed.current) as Radians;
        }
      } else {
        const turnSpeed = movementStats.maxTurnSpeed.current * input.turnRatio;
        velocity.currentTurnSpeed = (input.turnDirection * turnSpeed) as Radians;
        if (velocity.currentTurnSpeed !== 0) {
          transform.angle = (transform.angle + velocity.currentTurnSpeed * dt) as Radians;
        }
      }
      transform.angle = Math.atan2(Math.sin(transform.angle), Math.cos(transform.angle)) as Radians;

      // 3. Получение мирового вектора желаемого перемещения
      let moveVecX = input.desiredMoveVector ? input.desiredMoveVector.x : 0;
      let moveVecY = input.desiredMoveVector ? input.desiredMoveVector.y : 0;

      // Резервный расчет для совместимости, если заданы дискретные moveForward/moveStrafe
      if (!input.desiredMoveVector) {
        let fwd = input.moveForward ?? 0;
        let strafe = input.moveStrafe ?? 0;
        if (input.isMovingForward && fwd === 0 && strafe === 0) {
          fwd = 1;
        }
        if (fwd !== 0 || strafe !== 0) {
          const len = Math.hypot(fwd, strafe);
          const cosA = Math.cos(transform.angle);
          const sinA = Math.sin(transform.angle);
          moveVecX = (fwd / len) * cosA - (strafe / len) * sinA;
          moveVecY = (fwd / len) * sinA + (strafe / len) * cosA;
        }
      }

      const inputMag = Math.hypot(moveVecX, moveVecY);
      const hasMoveInput = inputMag > 0.001;
      if (hasMoveInput && inputMag > 1) {
        moveVecX /= inputMag;
        moveVecY /= inputMag;
      }

      // 4. Определение вида направления движения (Direction Mode)
      let directionMode: CreatureDirectionMode = 'immobile';

      if (hasMoveInput) {
        // Угол желаемого мирового вектора перемещения
        const desiredMoveAngle = Math.atan2(moveVecY, moveVecX);
        // Угол расхождения между направлением движения и текущим направлением взгляда
        const angleDiff = Math.abs(
          Math.atan2(
            Math.sin(desiredMoveAngle - transform.angle),
            Math.cos(desiredMoveAngle - transform.angle)
          )
        );

        const deg45 = Math.PI / 4 + 0.001;
        const deg135 = (3 * Math.PI) / 4 + 0.001;

        if (angleDiff <= deg45) {
          directionMode = 'forward';
        } else if (angleDiff <= deg135) {
          directionMode = 'strafe';
        } else {
          directionMode = 'backward';
        }
      } else if (velocity.currentSpeed > 1) {
        // При движении по инерции угол определяется по фактическому вектору текущей скорости
        const actualMoveAngle = Math.atan2(velocity.vy, velocity.vx);
        const angleDiff = Math.abs(
          Math.atan2(
            Math.sin(actualMoveAngle - transform.angle),
            Math.cos(actualMoveAngle - transform.angle)
          )
        );

        const deg45 = Math.PI / 4 + 0.001;
        const deg135 = (3 * Math.PI) / 4 + 0.001;

        if (angleDiff <= deg45) {
          directionMode = 'forward';
        } else if (angleDiff <= deg135) {
          directionMode = 'strafe';
        } else {
          directionMode = 'backward';
        }
      } else {
        directionMode = 'immobile';
      }

      // 5. Определение вида движения (Movement Mode): спринт разрешен ТОЛЬКО при движении вперед
      let movementMode: CreatureMovementMode = 'immobile';

      if (activeAttacks.attacks.length > 0) {
        movementMode = 'attacking';
      } else if (hasMoveInput || velocity.currentSpeed > 1) {
        if (input.isRunning && directionMode === 'forward') {
          movementMode = 'sprinting';
        } else if (input.isSlowWalking) {
          movementMode = 'walking';
        } else {
          movementMode = 'jogging';
        }
      } else if (
        input.turnDirection !== 0 ||
        (input.targetLookAngle !== undefined && Math.abs(velocity.currentTurnSpeed) > 0.01)
      ) {
        movementMode = 'turning';
      } else {
        movementMode = 'immobile';
      }

      // 6. Модификаторы от вида движения (спринт / шаг)
      if (movementMode === 'sprinting') {
        addModifier(movementStats.maxSpeed, {
          id: 'mode_sprint_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.runSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'mode_sprint_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.runTurnMultiplier,
        });
      } else if (movementMode === 'walking') {
        addModifier(movementStats.maxSpeed, {
          id: 'mode_walk_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.walkSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
      } else {
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
      }

      // 7. Модификаторы от вида направления движения (в сторону / назад)
      if (directionMode === 'strafe') {
        addModifier(movementStats.maxSpeed, {
          id: 'dir_strafe_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.strafeSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'dir_back_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'dir_strafe_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.strafeTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'dir_back_turn');
      } else if (directionMode === 'backward') {
        addModifier(movementStats.maxSpeed, {
          id: 'dir_back_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.backwardSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'dir_strafe_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'dir_back_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.backwardTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'dir_strafe_turn');
      } else {
        removeModifier(movementStats.maxSpeed, 'dir_strafe_speed');
        removeModifier(movementStats.maxSpeed, 'dir_back_speed');
        removeModifier(movementStats.maxTurnSpeed, 'dir_strafe_turn');
        removeModifier(movementStats.maxTurnSpeed, 'dir_back_turn');
      }

      // 8. Модификаторы замедления от атак
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

      // 9. Расчет мирового целевого вектора скорости и 2D векторная интерполяция
      let targetVx = 0;
      let targetVy = 0;

      if (hasMoveInput) {
        const targetSpeed = movementStats.maxSpeed.current;
        targetVx = moveVecX * targetSpeed;
        targetVy = moveVecY * targetSpeed;
      }

      const deltaVx = targetVx - velocity.vx;
      const deltaVy = targetVy - velocity.vy;
      const distToTargetVel = Math.hypot(deltaVx, deltaVy);

      if (distToTargetVel > 0.001) {
        // Скалярное произведение вектора скорости и вектора изменения скорости:
        // если оно отрицательно, вектор изменения направлен против движения (торможение)
        const isDecelerating = velocity.vx * deltaVx + velocity.vy * deltaVy < 0;
        const timeConstant = isDecelerating
          ? GAMEPLAY_CONFIG.decelerationTime
          : GAMEPLAY_CONFIG.accelerationTime;

        const maxSpd = movementStats.maxSpeed.current > 0 ? movementStats.maxSpeed.current : 1;
        const changeRate = maxSpd / timeConstant;
        const step = changeRate * dt;

        if (distToTargetVel <= step) {
          velocity.vx = targetVx;
          velocity.vy = targetVy;
        } else {
          velocity.vx += (deltaVx / distToTargetVel) * step;
          velocity.vy += (deltaVy / distToTargetVel) * step;
        }
      } else {
        velocity.vx = targetVx;
        velocity.vy = targetVy;
      }

      velocity.currentSpeed = Math.hypot(velocity.vx, velocity.vy);
      if (velocity.currentSpeed < 0.001) {
        velocity.vx = 0;
        velocity.vy = 0;
        velocity.currentSpeed = 0;
      }

      // 10. Обновление метаданных сущности
      meta.stance = stance;
      meta.movementMode = movementMode;
      meta.directionMode = directionMode;
    }
  }
}
