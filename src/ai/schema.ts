import { BTNode } from './core';

export type BBKeyType =
  'number' | 'string' | 'boolean' | 'entityId' | 'point' | 'path' | 'keys' | 'enum' | 'any';

export interface BBKeyDescriptor {
  type: BBKeyType;
  description?: string;
  defaultValue?: any;
  isSystem?: boolean;
  options?: string[];
}

export interface NodeBBSchema {
  reads?: Record<string, BBKeyDescriptor | BBKeyType>;
  writes?: Record<string, BBKeyDescriptor | BBKeyType>;
}

export interface CompiledBBKeyInfo {
  key: string;
  type: BBKeyType;
  accessMode: 'read' | 'write' | 'readwrite';
  description?: string;
  defaultValue?: any;
  isSystem: boolean;
  options?: string[];
  usedByNodes: Array<{ nodeName: string; mode: 'read' | 'write' }>;
}

export type TreeBBSchema = Record<string, CompiledBBKeyInfo>;

export function compileTreeBlackboardSchema(rootNode: BTNode): TreeBBSchema {
  const schema: TreeBBSchema = {};

  function processSchemaDefinition(
    nodeName: string,
    defs: Record<string, BBKeyDescriptor | BBKeyType> | undefined,
    mode: 'read' | 'write'
  ) {
    if (!defs) return;
    for (const [key, descOrType] of Object.entries(defs)) {
      const type = typeof descOrType === 'string' ? descOrType : descOrType.type;
      const desc = typeof descOrType === 'object' ? descOrType.description : undefined;
      const defVal = typeof descOrType === 'object' ? descOrType.defaultValue : undefined;
      const isSys = typeof descOrType === 'object' ? descOrType.isSystem : false;
      const options = typeof descOrType === 'object' ? descOrType.options : undefined;

      if (!schema[key]) {
        schema[key] = {
          key,
          type,
          accessMode: mode,
          description: desc,
          defaultValue: defVal,
          isSystem: isSys || false,
          options,
          usedByNodes: [{ nodeName, mode }],
        };
      } else {
        if (schema[key].accessMode !== mode) {
          schema[key].accessMode = 'readwrite';
        }
        if (!schema[key].description && desc) schema[key].description = desc;
        if (isSys) schema[key].isSystem = true;
        schema[key].usedByNodes.push({ nodeName, mode });
      }
    }
  }

  function traverse(node: any) {
    if (!node) return;

    // Считываем статическую схему из класса узла
    const nodeClass = node.constructor as any;
    if (nodeClass.bbSchema) {
      const sch = nodeClass.bbSchema as NodeBBSchema;
      processSchemaDefinition(node.name || nodeClass.name, sch.reads, 'read');
      processSchemaDefinition(node.name || nodeClass.name, sch.writes, 'write');
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    } else if (node.child) {
      traverse(node.child);
    }
  }

  traverse(rootNode);

  // Системные ключи, гарантированно присутствующие в любой симуляции
  if (!schema['localTime']) {
    schema['localTime'] = {
      key: 'localTime',
      type: 'number',
      accessMode: 'readwrite',
      isSystem: true,
      description: 'Локальное время',
      usedByNodes: [],
    };
  }

  return schema;
}
