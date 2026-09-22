import {
  BTActionAttack,
  BTCommandForgetTarget,
  BTActionPatrol,
  BTActionPursue,
  BTConditionValidTarget,
  BTCommandAcceptCandidate,
  BTConditionEngaged,
  BTWait,
  BTActionRotateToPos,
  BTAlwaysRunning,
} from './actions';
import { BTSelector, BTSequence } from './composites';
import { LOGIC_CONFIG } from './config';
import { BTNode, BTService } from './core';
import {
  BTServiceFindNearestTarget,
  BTServicePathUpdater,
  BTServiceSyncStats,
  BTServiceInputListener,
  BTServiceInputController,
} from './services';
import { t } from '../locales';

export const BEHAVIOR_TREES: Record<string, () => BTNode> = {
  PlayerTree: () => PlayerTree(),
  AttackerTree: () => AttackerTree(),
  FollowerTree: () => FollowerTree(),
  CombatTree: () => CombatTree(),
  IdleTree: () => new BTWait({ duration: 1 }),
};

export const BEHAVIOR_TREE_NAMES: Record<string, string> = {
  get PlayerTree() {
    return t('trees.PlayerTree');
  },
  get AttackerTree() {
    return t('trees.AttackerTree');
  },
  get FollowerTree() {
    return t('trees.FollowerTree');
  },
  get CombatTree() {
    return t('trees.CombatTree');
  },
  get IdleTree() {
    return t('trees.IdleTree');
  },
};

export function PlayerTree(): BTNode {
  return new BTServiceInputListener(new BTServiceInputController(new BTAlwaysRunning()));
}

export function CombatTree(): BTNode {
  return new BTServicePathUpdater(
    new BTSelector([
      new BTSequence([
        new BTConditionEngaged(),
        new BTActionRotateToPos(), // <- Разворачиваемся перед атакой
        new BTActionAttack(),
      ]),

      new BTActionPursue(),
    ])
  );
}

export function AttackerTree(): BTNode {
  return new BTServiceSyncStats(
    new BTServiceFindNearestTarget(
      new BTSelector([
        new BTSequence([
          new BTSelector([new BTConditionValidTarget(), new BTCommandAcceptCandidate()]),

          CombatTree(),
        ]),

        new BTSequence([new BTActionPatrol(), new BTWait({ duration: 1 })]),
      ]),
      { interval: 1.2 }
    ),
    { interval: 0.5 }
  );
}

export function FollowerTree(): BTNode {
  return new BTServiceSyncStats(
    new BTServiceFindNearestTarget(
      new BTSelector([
        new BTSequence([
          new BTSelector([new BTConditionValidTarget(), new BTCommandAcceptCandidate()]),
          new BTServicePathUpdater(
            new BTSelector([
              new BTSequence([new BTConditionEngaged(), new BTActionRotateToPos()]),
              new BTActionPursue(),
            ])
          ),
        ]),
        new BTWait({ duration: 1 }),
      ]),
      { interval: 1.2 }
    ),
    { interval: 0.5 }
  );
}
