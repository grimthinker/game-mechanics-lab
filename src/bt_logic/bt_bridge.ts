import { BTComposite, BTDecorator, BTNode, BTService, EntityContext, NodeStatus, NodeCategory } from "./core";


export interface BTNodeDTO {
    id?: string;
    name: string;
    category: NodeCategory;
    status?: NodeStatus;
    description?: string;
    parameters?: Record<string, any>;
    children: BTNodeDTO[];
}

export interface BTMessage {
    type: 'BT_TICK';
    payload: EntityBTState[];
}

export interface EntityBTState {
    entity_id: number;
    entity_name?: string;
    tree: BTNodeDTO;
    blackboard?: Record<string, any>; 
}

/**
 * Канал для передачи игровых данных вкладке с визуализатором SceneEditor (visualizer.html) от вкладки где запущена игра
 */
const bt_channel = new BroadcastChannel('bt_visualizer_sync');

const KNOWN_PARAMS = ['interval', 'durationMs', 'engage_dist', 'times', 'max', 'limitMs', 'delayMs', 'path_key'];


export function serializeBTNode(node: BTNode, path: string = 'root'): BTNodeDTO {
    const children: BTNodeDTO[] = [];

    // Извлекаем детей у композитов или декораторов
    if ('children' in node && Array.isArray((node as any).children)) {
        (node as any).children.forEach((child: BTNode, index: number) => {
            children.push(serializeBTNode(child, `${path}_${index}`));
        });
    } else if ('child' in node && (node as any).child) {
        children.push(serializeBTNode((node as any).child, `${path}_0`));
    }

    // Определяем статус узла
    // (нужен метод getStatus() или аналог, возвращающий NodeStatus)
    const rawStatus = (node as any).status ?? (node as any).lastStatus;
    let status: BTNodeDTO['status'] = NodeStatus[NodeStatus.IDLE];
    if (rawStatus === NodeStatus.RUNNING) status = NodeStatus[NodeStatus.RUNNING];
    else if (rawStatus === NodeStatus.SUCCESS) status = NodeStatus[NodeStatus.SUCCESS];
    else if (rawStatus === NodeStatus.FAILURE) status = NodeStatus[NodeStatus.FAILURE];

    const parameters: Record<string, any> = {};
    for (const key of KNOWN_PARAMS) {
        if (key in node && (node as any)[key] !== undefined) {
            parameters[key] = (node as any)[key];
        }
    }

    const result = {
        id: node.id,
        name: node.name,
        category: node.category,
        status,
        description: node.description,
        parameters,
        children
    };
    return result;
}

export function broadcast_bt_state(entities: EntityContext[]) {
    const active_trees: EntityBTState[] = entities
        .filter(e => e.brain && e.brain.root_node)
        .map(e => ({
            entity_id: e.id,
            entity_name: `Mob #${e.id}`,
            tree: serializeBTNode(e.brain!.root_node),
            blackboard: e.brain?.blackboard ? e.brain.blackboard.getData() : {}
        }));
    
    bt_channel.postMessage({ type: 'BT_TICK', payload: active_trees });
}