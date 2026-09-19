import { World } from '../../World';
import {
  BaseCreatureStance,
  TransitionCreatureStance,
  MovementStatsComponent,
  ModifierType,
} from '../../types';
import { addModifier, removeModifier } from '../../stats/StatEvaluator';

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

export class StanceSystem {
  public update(localDt: number, world: World): void {
    const entities = world.getEntitiesWith('input', 'health', 'meta', 'movementStats');

    for (const [id, { input, health, meta, movementStats }] of entities) {
      if (!health.isAlive) {
        world.removeComponent(id, 'stanceTransition');
        removeModifier(movementStats.maxSpeed, 'stance_speed');
        removeModifier(movementStats.maxTurnSpeed, 'stance_turn');
        removeModifier(movementStats.maxSpeed, 'locomotion_speed');
        removeModifier(movementStats.maxTurnSpeed, 'locomotion_turn');
        continue;
      }

      const locomotion = world.getComponent(id, 'locomotionState') || {
        speedMult: 1.0,
        turnMult: 1.0,
        canSprint: true,
        forceProneOnMove: false,
        canStand: true,
      };

      const wantsToMove =
        input.desiredMoveVector !== null ||
        input.isMovingForward ||
        (input.moveForward ?? 0) !== 0 ||
        (input.moveStrafe ?? 0) !== 0;

      if (!locomotion.canStand || (locomotion.forceProneOnMove && wantsToMove)) {
        input.desiredStance = 'prone';
      }

      let currentBaseStance: BaseCreatureStance = 'standing';
      if (meta.stance === 'crouching') currentBaseStance = 'crouching';
      else if (meta.stance === 'prone') currentBaseStance = 'prone';

      const desiredStance: BaseCreatureStance =
        input.desiredStance ?? (input.isCrouching ? 'crouching' : currentBaseStance);

      const activeTransition = world.getComponent(id, 'stanceTransition');

      if (activeTransition) {
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

      // Применение множителей скорости и поворота для стойки
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
    }
  }
}
