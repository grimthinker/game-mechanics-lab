import { trees_library } from "./config";
import { BehaviorConfig, BTLogicComponent, Blackboard } from "./core";


export function prepareAI(behavior: BehaviorConfig) {
    const root_node_gen = trees_library[behavior.bt_id];
    if (!root_node_gen) {
        throw new Error(`Не найдено behavior tree с id=${behavior.bt_id}`);
    }
    const logic: BTLogicComponent = {
        blackboard: new Blackboard(),
        event_queue: [],
        root_node: root_node_gen(),
        relations: behavior.relations,
        relations_group: behavior.relations_group
    }
    return logic;
}
