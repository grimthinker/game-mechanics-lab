import React from 'react';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';

export interface AIInspectorProps {
  behavior: string;
  onChange: (behavior: string) => void;
  isReadOnly?: boolean;
}

export const AIInspector: React.FC<AIInspectorProps> = ({ behavior, onChange, isReadOnly }) => (
  <label
    style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}
  >
    Поведение (AI):
    <select
      disabled={isReadOnly}
      value={behavior}
      onChange={(e) => onChange(e.target.value)}
      title={BEHAVIOR_TREE_NAMES[behavior] || behavior}
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        backgroundColor: '#111',
        color: '#fff',
        border: '1px solid #444',
        borderRadius: '4px',
        padding: '6px 8px',
        fontSize: '12px',
        cursor: isReadOnly ? 'default' : 'pointer',
      }}
    >
      {Object.entries(BEHAVIOR_TREE_NAMES).map(([id, name]) => (
        <option key={id} value={id} title={name}>
          {name}
        </option>
      ))}
    </select>
  </label>
);
