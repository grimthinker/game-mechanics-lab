// serializeBTNode.ts

import { NodeStatus, BTNode, BTNodeDTO } from './core';

const KNOWN_PARAMS = ['interval', 'duration', 'engage_dist', 'condition'];

export function serializeBTNode(node: BTNode, path: string = 'root'): BTNodeDTO {
    const children: BTNodeDTO[] = [];

    if ('children' in node && Array.isArray((node as any).children)) {
        (node as any).children.forEach((child: BTNode, index: number) => {
            children.push(serializeBTNode(child, `${path}_${index}`));
        });
    } else if ('child' in node && (node as any).child) {
        children.push(serializeBTNode((node as any).child, `${path}_0`));
    }

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

    return {
        id: (node as any).id || path,
        name: (node.constructor as any).nodeName || (node as any).name || 'BTNode',
        category: (node.constructor as any).category || (node as any).category || 'action',
        status,
        description: (node.constructor as any).description || (node as any).description,
        parameters,
        children
    };
}