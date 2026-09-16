import { LOGIC_CONFIG } from '../../../ai/config';
import { GAMEPLAY_CONFIG } from '../../../config/gameplayConfig';
import { Radians } from '../../../utils';
import { World } from '../../World';
import {
  CreatureDirectionMode,
  CreatureMovementMode,
  CreatureActionMode,
  ConsciousnessState,
} from '../../types';

export class VelocitySystem {
  public update(dt: number, localDt: number, world: World): void {
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
        meta.movementMode = 'immobile';
        meta.directionMode = 'immobile';
        meta.actionMode = 'idle';
        continue;
      }

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

      const interactionAction = world.getComponent(id, 'interactionAction');
      if (interactionAction) {
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

      // Вращение / Угол взгляда
      if (input.targetLookAngle !== undefined) {
        let diff = input.targetLookAngle - transform.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

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

      const physBodyComp = world.getComponent(id, 'physicsBody');
      if (physBodyComp && physBodyComp.body && typeof physBodyComp.body.setAngle === 'function') {
        physBodyComp.body.setAngle(transform.angle);
      }

      // Расчет вектора движения
      let moveVecX = input.desiredMoveVector ? input.desiredMoveVector.x : 0;
      let moveVecY = input.desiredMoveVector ? input.desiredMoveVector.y : 0;

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

      // Direction Mode
      let directionMode: CreatureDirectionMode = 'immobile';
      const ANGLE_THRESHOLD_FORWARD = Math.PI / 4 + 0.001;
      const ANGLE_THRESHOLD_BACKWARD = (3 * Math.PI) / 4 + 0.001;

      if (hasMoveInput) {
        const desiredMoveAngle = Math.atan2(moveVecY, moveVecX);
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

      // Action Mode
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

      // Movement Mode
      let movementMode: CreatureMovementMode = 'immobile';
      if (hasMoveInput || velocity.currentSpeed > 1) {
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

      // Интерполяция скорости (разгон / торможение)
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

      meta.movementMode = movementMode;
      meta.directionMode = directionMode;
      meta.actionMode = actionMode;
    }
  }
}
