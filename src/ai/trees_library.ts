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
  BTActionDropItem,
  BTActionPickupItem,
  BTConditionFetchState,
  BTActionSetTarget,
  BTActionFetchPickup,
  BTActionFetchDeliver,
  BTConditionDistance,
} from './actions';
import { BTSelector, BTReactiveSelector, BTSequence } from './composites';
import { LOGIC_CONFIG } from './config';
import { BTNode, BTService } from './core';
import {
  BTServiceFindNearestTarget,
  BTServicePathUpdater,
  BTServiceSyncStats,
  BTServiceInputListener,
  BTServiceInputController,
  BTServiceFetchWatcher,
} from './services';
import { t } from '../locales';

export const BEHAVIOR_TREES: Record<string, () => BTNode> = {
  PlayerTree: () => PlayerTree(),
  AttackerTree: () => AttackerTree(),
  FollowerTree: () => FollowerTree(),
  DogFetchTree: () => DogFetchTree(),
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
  get DogFetchTree() {
    return t('trees.DogFetchTree');
  },
  get CombatTree() {
    return t('trees.CombatTree');
  },
  get IdleTree() {
    return t('trees.IdleTree');
  },
};

export function PlayerTree(): BTNode {
  return new BTServiceInputListener(
    new BTServiceInputController(
      new BTReactiveSelector([
        new BTActionDropItem(),
        new BTActionPickupItem(),
        new BTAlwaysRunning(),
      ])
    )
  );
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

export function DogFetchTree(): BTNode {
  return new BTServiceSyncStats(
    new BTServiceFetchWatcher(
      new BTReactiveSelector([
        // ВЕТКА 1: Доставка палки хозяину и сброс под ноги
        new BTSequence([
          new BTConditionFetchState({ expectedState: 'returning' }),
          new BTActionSetTarget({ sourceKey: 'masterEntityId' }),
          new BTServicePathUpdater(
            new BTSequence([
              new BTActionPursue({ stopDist: 1.5 }),
              new BTConditionDistance({ maxDistance: 2.2 }),
              new BTActionRotateToPos(),
              new BTActionFetchDeliver(),
            ])
          ),
        ]),

        // ВЕТКА 2: Погоня за брошенной палкой и взятие в челюсти
        new BTSequence([
          new BTConditionFetchState({ expectedState: 'chasing_item' }),
          new BTActionSetTarget({ sourceKey: 'fetchTargetId' }),
          new BTServicePathUpdater(
            new BTSequence([new BTActionPursue({ stopDist: 0.6 }), new BTActionFetchPickup()])
          ),
        ]),

        // ВЕТКА 3: Обычное следование за хозяином
        new BTSequence([
          new BTActionSetTarget({ sourceKey: 'masterEntityId' }),
          new BTServicePathUpdater(
            new BTSelector([
              new BTSequence([new BTConditionEngaged(), new BTActionRotateToPos()]),
              new BTActionPursue(),
            ])
          ),
        ]),

        new BTWait({ duration: 1 }),
      ]),
      { interval: 0.1 }
    ),
    { interval: 0.5 }
  );
}
