import React from 'react';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';

export interface AIInspectorProps {
  behavior: string;
  onChange: (behavior: string) => void;
  isReadOnly?: boolean;
}

export const AIInspector: React.FC<AIInspectorProps> = ({ behavior, onChange, isReadOnly }) => (
  <label>
    Поведение (AI):
    <select
      disabled={isReadOnly}
      value={behavior}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(BEHAVIOR_TREE_NAMES).map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  </label>
);