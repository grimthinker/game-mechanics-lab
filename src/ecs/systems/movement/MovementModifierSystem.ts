import { World } from '../../World';
import { ModifierType } from '../../types';
import { addModifier, removeModifier } from '../../stats/StatEvaluator';

export class MovementModifierSystem {
  public update(world: World): void {
    const entities = world.getEntitiesWith(
      'input',
      'health',
      'activeAttacks',
      'meta',
      'movementStats'
    );

    for (const [id, { input, health, activeAttacks, meta, movementStats }] of entities) {
      if (!health.isAlive) continue;

      const locomotion = world.getComponent(id, 'locomotionState') || {
        speedMult: 1.0,
        turnMult: 1.0,
        canSprint: true,
        forceProneOnMove: false,
      };

      if (!locomotion.canSprint) {
        input.isRunning = false;
      }

      const interactionAction = world.getComponent(id, 'interactionAction');
      if (interactionAction) {
        if (interactionAction.type !== 'throw') {
          input.isRunning = false;
        }
        input.wantsAttack = false;
      }

      if (meta.stance === 'prone' || meta.stance?.includes('prone')) {
        input.isRunning = false;
      }

      // Запрещаем спринт во время активных атак (устранение эксплойта)
      if (activeAttacks.attacks.length > 0) {
        input.isRunning = false;
      }

      // Модификаторы локомоции (штрафы от сломанных или отсутствующих конечностей)
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

      const movementMode = meta.movementMode ?? 'immobile';
      const directionMode = meta.directionMode ?? 'immobile';
      const actionMode = meta.actionMode ?? 'idle';

      // Модификаторы режима движения
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

      // Модификаторы направления движения
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

      // Замедления от атак
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

      // Замедления от подбора предметов
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
    }
  }
}
