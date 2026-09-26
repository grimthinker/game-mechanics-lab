import { EntityConfig, MovementConfig } from '../types';

export type BodyStructureType = 'humanoid' | 'quadruped' | 'arachnid';

export interface BlueprintPartDef {
  key: string;
  meshAsset?: string;
  rigNodeName?: string;
  config: EntityConfig;
}

export interface BlueprintConnectionDef {
  fromPartKey: string;
  fromSocket: string;
  toPartKey: string;
  toSocket: string;
}

export interface BlueprintItemDef {
  targetPartKey: string;
  targetAreaType: string;
  config: EntityConfig;
}

export interface CreatureBodyBlueprint {
  id: BodyStructureType;
  name: string;
  rigAsset?: string;
  movement?: Partial<MovementConfig>;
  parts: BlueprintPartDef[];
  connections: BlueprintConnectionDef[];
  defaultItems?: BlueprintItemDef[];
}
