import { BTNode, BTNodeDTO, NodeStatus, BTService } from './core';

interface BTNodeConstructor {
  nodeName?: string;
  description?: string;
}

// 2. Вспомогательные интерфейсы для сужения типов узлов с ветвлением
interface NodeWithChildren extends BTNode {
  children: BTNode[];
}

interface NodeWithChild extends BTNode {
  child: BTNode;
}

// 3. Служебные ключи, которые не нужно помещать в параметры
const IGNORED_PARAM_KEYS = new Set<string>([
  'status',
  'elapsedSinceLastTick',
  'timeToNextTick',
]);

export function serializeBTNode(node: BTNode, path: string = 'root'): BTNodeDTO {
  const children: BTNodeDTO[] = [];

  // Сбор дочерних узлов через Type Guard ('children' in node / 'child' in node)
  if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
      children.push(serializeBTNode(child, `${path}_${index}`));
    });
  } else if ('child' in node) {
    children.push(serializeBTNode((node as NodeWithChild).child, `${path}_0`));
  }

  // Определение статуса без приведения к any
  const lastStatus = 'lastStatus' in node ? node.lastStatus : undefined;
  const status: NodeStatus = lastStatus && lastStatus in NodeStatus ? lastStatus : NodeStatus.IDLE;

  const nodeName = node.name || node.constructor.name || 'Node';
  const description = node.description;

  const parameters: Record<string, unknown> = {};

  if ('params' in node && typeof node.params === 'object') {
    Object.assign(parameters, node.params);
  }

//   const objRecord = node as unknown as Record<string, unknown>;
//   for (const key of Object.keys(node)) {
//     if (!IGNORED_PARAM_KEYS.has(key) && objRecord[key] !== undefined && typeof objRecord[key] !== 'function') {
//       parameters[key] = objRecord[key];
//     }
//   }

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