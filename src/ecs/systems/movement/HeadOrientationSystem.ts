import { World } from '../../World';
import { angleDifference, normalizeAngle, Radians } from '../../../utils';
import { BALANCE_CONFIG } from '../../../config/balanceConfig';
import { CREATURE_BLUEPRINTS, BodyStructureType } from '../../templates';
import { createStat } from '../../stats/StatEvaluator';

export class HeadOrientationSystem {
  public update(dt: number, world: World): void {
    const entities = world.getEntitiesWith('transform', 'input', 'animator');

    for (const [id, { transform, input, animator }] of entities) {
      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      const localDt = dt * ts;
      if (localDt <= 0) continue;

      let headOrientation = world.getComponent(id, 'headOrientation');
      if (!headOrientation) {
        const headTurnSpeed = BALANCE_CONFIG.creature.defaultHeadTurnSpeed;
        world.addComponent(id, 'headOrientation', {
          yaw: transform.angle,
          pitch: 0 as Radians,
          relativeYaw: 0 as Radians,
          relativePitch: 0 as Radians,
          yawVelocity: 0,
          pitchVelocity: 0,
          turnSpeed: createStat(headTurnSpeed),
        });
        headOrientation = world.getComponent(id, 'headOrientation')!;
      }

      const activeAttacks = world.getComponent(id, 'activeAttacks');
      const interaction = world.getComponent(id, 'interactionAction');
      const stanceTrans = world.getComponent(id, 'stanceTransition');

      let wantsNeutral = input.wantsLookNeutral ?? false;
      if ((activeAttacks && activeAttacks.attacks.length > 0) || interaction || stanceTrans) {
        wantsNeutral = true;
      }

      const rigType = animator.rigType as BodyStructureType;
      const blueprint = CREATURE_BLUEPRINTS[rigType];
      const limits = blueprint?.headLimits ?? { minYaw: 0, maxYaw: 0, minPitch: 0, maxPitch: 0 };

      let targetWorldYaw = transform.angle;
      let targetPitch = 0 as Radians;
      let speedMult = 1.0;

      if (wantsNeutral) {
        targetWorldYaw = transform.angle;
        targetPitch = 0 as Radians;
        speedMult = BALANCE_CONFIG.creature.headNeutralReturnSpeedMultiplier;
      } else {
        if (input.targetLookAngle !== undefined) {
          targetWorldYaw = input.targetLookAngle;
        }
        if (input.targetLookPitch !== undefined) {
          targetPitch = Math.max(
            limits.minPitch,
            Math.min(limits.maxPitch, input.targetLookPitch)
          ) as Radians;
        }
      }

      let localTargetYaw = angleDifference(targetWorldYaw, transform.angle);
      localTargetYaw = Math.max(limits.minYaw, Math.min(limits.maxYaw, localTargetYaw)) as Radians;

      const currentLocalYaw = headOrientation.relativeYaw ?? 0;
      const currentLocalPitch = headOrientation.relativePitch ?? 0;
      const maxSpeed =
        (headOrientation.turnSpeed?.current ?? BALANCE_CONFIG.creature.defaultHeadTurnSpeed) *
        speedMult;
      const accel = BALANCE_CONFIG.creature.headAngularAcceleration;

      // 1. Плавный поворот головы по горизонтали (Yaw) с разгоном от 0 и торможением до 0
      let diffYaw = angleDifference(localTargetYaw, currentLocalYaw);
      let curVelYaw = headOrientation.yawVelocity ?? 0;
      let newLocalYaw = currentLocalYaw;

      if (
        Math.abs(diffYaw) <= BALANCE_CONFIG.creature.headAngleTolerance &&
        Math.abs(curVelYaw) < 0.05
      ) {
        newLocalYaw = localTargetYaw;
        curVelYaw = 0;
      } else {
        const signYaw = Math.sign(diffYaw) || 1;
        const stopSpeedYaw = Math.sqrt(2 * accel * Math.abs(diffYaw));
        const desiredVelYaw = signYaw * Math.min(maxSpeed, stopSpeedYaw);

        const deltaVel = desiredVelYaw - curVelYaw;
        const maxDeltaVel = accel * localDt;

        if (Math.abs(deltaVel) <= maxDeltaVel) {
          curVelYaw = desiredVelYaw;
        } else {
          curVelYaw += Math.sign(deltaVel) * maxDeltaVel;
        }

        const stepYaw = curVelYaw * localDt;
        if (Math.abs(stepYaw) >= Math.abs(diffYaw) && Math.sign(stepYaw) === signYaw) {
          newLocalYaw = localTargetYaw;
          curVelYaw = 0;
        } else {
          newLocalYaw = normalizeAngle(currentLocalYaw + stepYaw);
        }
      }

      // 2. Плавный наклон головы по вертикали (Pitch) с разгоном от 0 и торможением до 0
      let diffPitch = targetPitch - currentLocalPitch;
      let curVelPitch = headOrientation.pitchVelocity ?? 0;
      let newLocalPitch = currentLocalPitch;

      if (
        Math.abs(diffPitch) <= BALANCE_CONFIG.creature.headAngleTolerance &&
        Math.abs(curVelPitch) < 0.05
      ) {
        newLocalPitch = targetPitch;
        curVelPitch = 0;
      } else {
        const signPitch = Math.sign(diffPitch) || 1;
        const stopSpeedPitch = Math.sqrt(2 * accel * Math.abs(diffPitch));
        const desiredVelPitch = signPitch * Math.min(maxSpeed, stopSpeedPitch);

        const deltaVel = desiredVelPitch - curVelPitch;
        const maxDeltaVel = accel * localDt;

        if (Math.abs(deltaVel) <= maxDeltaVel) {
          curVelPitch = desiredVelPitch;
        } else {
          curVelPitch += Math.sign(deltaVel) * maxDeltaVel;
        }

        const stepPitch = curVelPitch * localDt;
        if (Math.abs(stepPitch) >= Math.abs(diffPitch) && Math.sign(stepPitch) === signPitch) {
          newLocalPitch = targetPitch;
          curVelPitch = 0;
        } else {
          newLocalPitch = Math.max(
            limits.minPitch,
            Math.min(limits.maxPitch, currentLocalPitch + stepPitch)
          ) as Radians;
        }
      }

      headOrientation.yawVelocity = Number.isFinite(curVelYaw) ? curVelYaw : 0;
      headOrientation.pitchVelocity = Number.isFinite(curVelPitch) ? curVelPitch : 0;
      headOrientation.relativeYaw = Number.isFinite(newLocalYaw) ? newLocalYaw : (0 as Radians);
      headOrientation.relativePitch = Number.isFinite(newLocalPitch)
        ? newLocalPitch
        : (0 as Radians);
      headOrientation.yaw = normalizeAngle(transform.angle + headOrientation.relativeYaw);
      headOrientation.pitch = headOrientation.relativePitch;
    }
  }
}
