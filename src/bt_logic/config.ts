import { BTNode } from "./core";
import { AttackerTree } from "./trees_library";


export enum MobTypeId {
    BOAR = 'mob_boar',
    SPIDER = 'mob_spider',
    RABBIT = 'mob_rabbit',
    BEAR = 'mob_bear'
}

export const PLAYER = 'player' as const;

export enum BehaviorTreeId {
    ATTACKER = 'attacker',
    PEACEFULL = 'peacefull',
}

export const LOGIC_CONFIG = {
    min_path_request_interval: 0.1,
    default_follow_stop_dist_mult: 1.2,
    default_in_pos_dist_mult: 1.2
}


/**
 * Примеры деревьев поведения, для тестов
 */
export const trees_library: Partial<Record<BehaviorTreeId, () => BTNode>> = {
    [BehaviorTreeId.ATTACKER]: AttackerTree,
}