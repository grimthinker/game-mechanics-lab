import { Radians } from '../../utils';
import { World } from '../World';
import {
  CreatureDirectionMode,
  CreatureMovementMode,
  CreatureActionMode,
  CreatureStance,
  ModifierType,
} from '../types';
import { addModifier, removeModifier } from '../stats/StatEvaluator';
import { GAMEPLAY_CONFIG } from '../../config/gameplayConfig';
import { LOGIC_CONFIG } from '../../ai/config';

import {
  BaseCreatureStance,
  TransitionCreatureStance,
  MovementStatsComponent,
  ConsciousnessState,
} from '../types';

function getTransitionStance(
  from: BaseCreatureStance,
  to: BaseCreatureStance
): TransitionCreatureStance {
  if (from === 'standing' && to === 'crouching') return 'stand_to_crouch';
  if (from === 'crouching' && to === 'standing') return 'crouch_to_stand';
  if (from === 'crouching' && to === 'prone') return 'crouch_to_prone';
  if (from === 'prone' && to === 'crouching') return 'prone_to_crouch';
  if (from === 'standing' && to === 'prone') return 'stand_to_prone';
  return 'prone_to_stand';
}

function getTransitionDuration(
  from: BaseCreatureStance,
  to: BaseCreatureStance,
  stats: MovementStatsComponent
): number {
  if (from === 'standing' && to === 'crouching')
    return Math.max(0.01, stats.standToCrouchTime.current);
  if (from === 'crouching' && to === 'standing')
    return Math.max(0.01, stats.crouchToStandTime.current);
  if (from === 'standing' && to === 'prone') return Math.max(0.01, stats.standToProneTime.current);
  if (from === 'prone' && to === 'standing') return Math.max(0.01, stats.proneToStandTime.current);
  if (from === 'crouching' && to === 'prone')
    return Math.max(0.01, stats.crouchToProneTime.current);
  return Math.max(0.01, stats.proneToCrouchTime.current);
}

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
      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      const localDt = dt * ts;

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
        world.removeComponent(id, 'stanceTransition');
        removeModifier(movementStats.maxSpeed, 'stance_speed');
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');
        removeModifier(movementStats.maxSpeed, 'attack_slow_move');
        removeModifier(movementStats.maxSpeed, 'pickup_slow_move');
        removeModifier(movementStats.maxSpeed, 'dir_strafe_speed');
        removeModifier(movementStats.maxSpeed, 'dir_back_speed');
        removeModifier(movementStats.maxSpeed, 'locomotion_speed');
        removeModifier(movementStats.maxTurnSpeed, 'stance_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_walk_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_turning_turn');
        removeModifier(movementStats.maxTurnSpeed, 'attack_slow_turn');
        removeModifier(movementStats.maxTurnSpeed, 'pickup_slow_turn');
        removeModifier(movementStats.maxTurnSpeed, 'dir_strafe_turn');
        removeModifier(movementStats.maxTurnSpeed, 'dir_back_turn');
        removeModifier(movementStats.maxTurnSpeed, 'locomotion_turn');
        meta.movementMode = 'immobile';
        meta.directionMode = 'immobile';
        meta.actionMode = 'idle';
        continue;
      }

      // 0. Оценка состояния сознания
      const consciousnessComp = world.getComponent(id, 'consciousness');
      const consciousness = consciousnessComp
        ? consciousnessComp.state
        : ConsciousnessState.CONSCIOUS;
      if (consciousness === ConsciousnessState.UNCONSCIOUS) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
        input.turnDirection = 0;
        input.turnRatio = 0;
        input.isRunning = false;
        input.wantsAttack = false;
        input.attackSlotIndex = undefined;
        input.desiredStance = 'prone';
        meta.actionMode = 'idle';
      }

      // 0.5. Оценка состояния опорно-двигательного аппарата (ног)
      const locomotion = world.getComponent(id, 'locomotionState') || {
        speedMult: 1.0,
        turnMult: 1.0,
        canSprint: true,
        forceProneOnMove: false,
        canStand: true,
      };

      if (!locomotion.canSprint) {
        input.isRunning = false;
      }

      if (!locomotion.canStand) {
        input.desiredStance = 'prone';
      }

      const wantsToMove =
        input.desiredMoveVector !== null ||
        input.isMovingForward ||
        (input.moveForward ?? 0) !== 0 ||
        (input.moveStrafe ?? 0) !== 0;

      // При 1 целой и всех остальных разрушенных ногах попытка движения роняет существо в prone
      if (locomotion.forceProneOnMove && wantsToMove) {
        input.desiredStance = 'prone';
      }

      const interactionAction = world.getComponent(id, 'interactionAction');
      if (interactionAction) {
        // Запрещаем спринт и атаку во время взаимодействия, но перемещение не блокируем
        input.isRunning = false;
        input.wantsAttack = false;

        if (
          interactionAction.type === 'pickup' &&
          interactionAction.phase === 'reach' &&
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

      // 1. Положение существа (Stance State Machine & Transitions)
      let currentBaseStance: BaseCreatureStance = 'standing';
      if (meta.stance === 'crouching') currentBaseStance = 'crouching';
      else if (meta.stance === 'prone') currentBaseStance = 'prone';

      const desiredStance: BaseCreatureStance =
        input.desiredStance ?? (input.isCrouching ? 'crouching' : currentBaseStance);

      const activeTransition = world.getComponent(id, 'stanceTransition');

      if (activeTransition) {
        // Проверка отмены: если игрок запросил возврат к исходной стойке fromStance
        if (desiredStance === activeTransition.fromStance) {
          const progress = Math.min(
            1,
            Math.max(0, 1 - activeTransition.timer / (activeTransition.totalDuration || 1))
          );
          const originalFrom = activeTransition.fromStance;
          const originalTo = activeTransition.toStance;
          const fullReverseDuration = getTransitionDuration(
            originalTo,
            originalFrom,
            movementStats
          );
          const returnDuration = Math.max(0.01, progress * fullReverseDuration);

          activeTransition.fromStance = originalTo;
          activeTransition.toStance = originalFrom;
          activeTransition.timer = returnDuration;
          activeTransition.totalDuration = returnDuration;
          activeTransition.transitionStance = getTransitionStance(originalTo, originalFrom);
          meta.stance = activeTransition.transitionStance;
        }

        activeTransition.timer -= localDt;
        if (activeTransition.timer <= 0) {
          meta.stance = activeTransition.toStance;
          world.removeComponent(id, 'stanceTransition');
        } else {
          meta.stance = activeTransition.transitionStance;
        }
      } else if (desiredStance !== currentBaseStance) {
        const transStance = getTransitionStance(currentBaseStance, desiredStance);
        const duration = getTransitionDuration(currentBaseStance, desiredStance, movementStats);
        world.addComponent(id, 'stanceTransition', {
          fromStance: currentBaseStance,
          toStance: desiredStance,
          timer: duration,
          totalDuration: duration,
          transitionStance: transStance,
        });
        meta.stance = transStance;
      } else if (meta.stance !== currentBaseStance) {
        meta.stance = currentBaseStance;
      }

      // Запрет спринта только в положении лежа и во всех переходах, связанных с prone
      if (meta.stance === 'prone' || meta.stance?.includes('prone')) {
        input.isRunning = false;
      }

      // Расчет множителей скорости и поворота для текущей стойки
      let stanceSpeedMult = 1.0;
      let stanceTurnMult = 1.0;

      const crouchSpd = movementStats.crouchSpeedMultiplier;
      const crouchTurn = movementStats.crouchTurnMultiplier;
      const proneSpd = movementStats.proneSpeedMultiplier;
      const proneTurn = movementStats.proneTurnMultiplier;

      switch (meta.stance) {
        case 'standing':
          stanceSpeedMult = 1.0;
          stanceTurnMult = 1.0;
          break;
        case 'crouching':
          stanceSpeedMult = crouchSpd;
          stanceTurnMult = crouchTurn;
          break;
        case 'prone':
          stanceSpeedMult = proneSpd;
          stanceTurnMult = proneTurn;
          break;
        case 'stand_to_crouch':
        case 'crouch_to_stand':
          stanceSpeedMult = (1.0 + crouchSpd) / 2;
          stanceTurnMult = (1.0 + crouchTurn) / 2;
          break;
        case 'stand_to_prone':
        case 'prone_to_stand':
          stanceSpeedMult = (1.0 + proneSpd) / 2;
          stanceTurnMult = (1.0 + proneTurn) / 2;
          break;
        case 'crouch_to_prone':
        case 'prone_to_crouch':
          stanceSpeedMult = (crouchSpd + proneSpd) / 2;
          stanceTurnMult = (crouchTurn + proneTurn) / 2;
          break;
      }

      if (stanceSpeedMult !== 1.0) {
        addModifier(movementStats.maxSpeed, {
          id: 'stance_speed',
          type: ModifierType.PERCENT_MULT,
          value: stanceSpeedMult,
        });
      } else {
        removeModifier(movementStats.maxSpeed, 'stance_speed');
      }

      if (stanceTurnMult !== 1.0) {
        addModifier(movementStats.maxTurnSpeed, {
          id: 'stance_turn',
          type: ModifierType.PERCENT_MULT,
          value: stanceTurnMult,
        });
      } else {
        removeModifier(movementStats.maxTurnSpeed, 'stance_turn');
      }

      // Применение штрафов повреждения ног (Локомоция)
      if (locomotion.speedMult !== 1.0) {
        addModifier(movementStats.maxSpeed, {
          id: 'locomotion_speed',
          type: ModifierType.PERCENT_MULT,
          value: locomotion.speedMult,
        });
      } else {
        removeModifier(movementStats.maxSpeed, 'locomotion_speed');
      }

      if (locomotion.turnMult !== 1.0) {
        addModifier(movementStats.maxTurnSpeed, {
          id: 'locomotion_turn',
          type: ModifierType.PERCENT_MULT,
          value: locomotion.turnMult,
        });
      } else {
        removeModifier(movementStats.maxTurnSpeed, 'locomotion_turn');
      }

      // 2. Поворот корпуса / взгляда существа (независимо от вектора движения)
      if (input.targetLookAngle !== undefined) {
        let diff = input.targetLookAngle - transform.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

        // Если разница в пределах допуска (мертвая зона / tolerance), фиксируем угол и обнуляем угловую скорость во избежание микро-дрожания
        if (Math.abs(diff) <= LOGIC_CONFIG.angleDiffTolerance) {
          transform.angle = input.targetLookAngle;
          velocity.currentTurnSpeed = 0 as Radians;
        } else if (localDt > 0) {
          const maxTurnStep = movementStats.maxTurnSpeed.current * localDt;
          if (Math.abs(diff) <= maxTurnStep) {
            transform.angle = input.targetLookAngle;
            velocity.currentTurnSpeed = (diff / localDt) as Radians;
          } else {
            const sign = Math.sign(diff) as -1 | 1;
            transform.angle = (transform.angle + sign * maxTurnStep) as Radians;
            velocity.currentTurnSpeed = (sign * movementStats.maxTurnSpeed.current) as Radians;
          }
        } else {
          velocity.currentTurnSpeed = 0 as Radians;
        }
      } else {
        const turnSpeed = movementStats.maxTurnSpeed.current * input.turnRatio;
        velocity.currentTurnSpeed = (input.turnDirection * turnSpeed) as Radians;
        if (velocity.currentTurnSpeed !== 0) {
          transform.angle = (transform.angle + velocity.currentTurnSpeed * localDt) as Radians;
        }
      }
      transform.angle = Math.atan2(Math.sin(transform.angle), Math.cos(transform.angle)) as Radians;

      // Синхронизация угла с физическим телом (SSOT -> Physics Body)
      const physBodyComp = world.getComponent(id, 'physicsBody');
      if (physBodyComp && physBodyComp.body && typeof physBodyComp.body.setAngle === 'function') {
        physBodyComp.body.setAngle(transform.angle);
      }

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
      const ANGLE_THRESHOLD_FORWARD = Math.PI / 4 + 0.001;
      const ANGLE_THRESHOLD_BACKWARD = (3 * Math.PI) / 4 + 0.001;

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

        if (angleDiff <= ANGLE_THRESHOLD_FORWARD) {
          directionMode = 'forward';
        } else if (angleDiff <= ANGLE_THRESHOLD_BACKWARD) {
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

        if (angleDiff <= ANGLE_THRESHOLD_FORWARD) {
          directionMode = 'forward';
        } else if (angleDiff <= ANGLE_THRESHOLD_BACKWARD) {
          directionMode = 'strafe';
        } else {
          directionMode = 'backward';
        }
      } else {
        directionMode = 'immobile';
      }

      // 4.5. Определение режима активности (Action Mode для UI)
      let actionMode: CreatureActionMode = 'idle';
      if (activeAttacks.attacks.length > 0) {
        actionMode = 'attacking';
      } else if (interactionAction?.type === 'pickup') {
        actionMode = 'pickup';
      } else if (interactionAction?.type === 'equip' || interactionAction?.type === 'unequip') {
        actionMode = 'equipping';
      } else if (world.getComponent(id, 'stanceTransition')) {
        actionMode = 'stance_changing';
      }

      // 5. Определение вида движения (Movement Mode): чисто локомоция
      let movementMode: CreatureMovementMode = 'immobile';

      if (hasMoveInput || velocity.currentSpeed > 1) {
        // В положении лежа (prone) и любых переходах с ним (ложится/встает) разрешен только шаг
        if (meta.stance === 'prone' || meta.stance?.includes('prone')) {
          movementMode = 'walking';
        } else if (
          input.isRunning &&
          directionMode === 'forward' &&
          (meta.stance === 'standing' ||
            meta.stance === 'crouching' ||
            meta.stance === 'stand_to_crouch' ||
            meta.stance === 'crouch_to_stand')
        ) {
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

      // 6. Модификаторы от вида движения (спринт / шаг / поворот на месте)
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
        removeModifier(movementStats.maxTurnSpeed, 'mode_walk_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_turning_turn');
      } else if (movementMode === 'walking') {
        addModifier(movementStats.maxSpeed, {
          id: 'mode_walk_speed',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.walkSpeedMultiplier,
        });
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'mode_walk_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.walkTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_turning_turn');
      } else if (movementMode === 'turning') {
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');

        addModifier(movementStats.maxTurnSpeed, {
          id: 'mode_turning_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.turnInPlaceTurnMultiplier,
        });
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_walk_turn');
      } else {
        removeModifier(movementStats.maxSpeed, 'mode_sprint_speed');
        removeModifier(movementStats.maxSpeed, 'mode_walk_speed');
        removeModifier(movementStats.maxTurnSpeed, 'mode_sprint_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_walk_turn');
        removeModifier(movementStats.maxTurnSpeed, 'mode_turning_turn');
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
        addModifier(movementStats.maxTurnSpeed, {
          id: 'attack_slow_turn',
          type: ModifierType.PERCENT_MULT,
          value: turnSlow,
        });
      } else {
        removeModifier(movementStats.maxTurnSpeed, 'attack_slow_turn');
      }

      // 8.5. Модификаторы скорости перемещения и поворота при подборе предметов
      if (actionMode === 'pickup') {
        addModifier(movementStats.maxSpeed, {
          id: 'pickup_slow_move',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.pickupSpeedMultiplier,
        });
        addModifier(movementStats.maxTurnSpeed, {
          id: 'pickup_slow_turn',
          type: ModifierType.PERCENT_MULT,
          value: movementStats.pickupTurnMultiplier,
        });
      } else {
        removeModifier(movementStats.maxSpeed, 'pickup_slow_move');
        removeModifier(movementStats.maxTurnSpeed, 'pickup_slow_turn');
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
        const step = changeRate * localDt;

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
      meta.movementMode = movementMode;
      meta.directionMode = directionMode;
      meta.actionMode = actionMode;
    }
  }
}
