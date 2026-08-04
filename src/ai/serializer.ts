import { BTNode, BTNodeDTO, NodeStatus, BTService } from './core';


interface NodeWithChild extends BTNode {
  child: BTNode;
}


export function serializeBTNode(node: BTNode, path: string = 'root'): BTNodeDTO {
  const children: BTNodeDTO[] = [];

  if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
      children.push(serializeBTNode(child, `${path}_${index}`));
    });
  } else if ('child' in node) {
    children.push(serializeBTNode((node as NodeWithChild).child, `${path}_0`));
  }

  const lastStatus = 'lastStatus' in node ? node.lastStatus : undefined;
  const status: NodeStatus = lastStatus && lastStatus in NodeStatus ? lastStatus : NodeStatus.IDLE;

  const nodeName = node.name || node.constructor.name || 'Node';
  const description = node.description;

  const parameters: Record<string, unknown> = {};

  if ('params' in node && typeof node.params === 'object') {
    Object.assign(parameters, node.params);
  }


  let timeToNextTick: number | undefined = undefined;

  if (node instanceof BTService) {
    timeToNextTick = node.timeRemains
    // console.log(timeToNextTick)
  } 

  return {
    id: node.id || path,
    name: nodeName,
    category: node.category,
    status: status,
    description: description,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    timeToNextTick: timeToNextTick,
    children: children,
  };
}