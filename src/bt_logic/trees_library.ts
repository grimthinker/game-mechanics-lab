import { BTActionAttack, BTCommandForgetTarget, BTActionPatrol, BTActionPursue, BTConditionValidTarget, BTCommandAcceptCandidate, BTConditionEngaged, BTSucceedImmediately, BTActionLookAtTarget, BTWait } from "./actions";
import { BTSelector, BTSequence } from "./composites";
import { LOGIC_CONFIG } from "./config";
import { BTNode, BTService } from "./core";
import { BTInverter } from "./decorators";
import { BTServiceFindNearestTarget,  BTServicePathUpdater, BTServiceSyncStats } from "./services";



export function CombatTree(): BTNode {
    return new BTServicePathUpdater(
        new BTSelector([
            new BTSequence([
                new BTConditionEngaged(), 
                new BTActionLookAtTarget(), // <- Разворачиваемся перед атакой
                new BTActionAttack() 
            ]),

            new BTActionPursue()
        ])
    );
}

export function AttackerTree(): BTNode {
    return new BTServiceSyncStats(
        new BTServiceFindNearestTarget(
            new BTSelector([
                new BTSequence([
                    new BTSelector([
                        new BTConditionValidTarget(),
                        new BTCommandAcceptCandidate() 
                    ]),
                    
                    CombatTree()
                ]),

                new BTSequence([
                    new BTActionPatrol(),
                    new BTWait({duration: 1})
                ])
            ]), { interval: 0.5 }
        ), { interval: 0.2 }
    );
}
