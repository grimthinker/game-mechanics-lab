import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';
import { t } from '../../locales';

export interface AIInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const AIInspector: React.FC<AIInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const aiStats = world.getComponent(targetId, 'aiStats');
  const [behavior, setBehavior] = useState(aiStats?.behavior.current ?? 'IdleTree');

  useEffect(() => {
    const comp = world.getComponent(targetId, 'aiStats');
    if (comp) setBehavior(comp.behavior.current);
  }, [targetId, world]);

  if (!aiStats) return null;

  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}
    >
      {t('aiInspector.behavior')}
      <select
        disabled={isReadOnly}
        value={behavior}
        onChange={(e) => {
          const val = e.target.value;
          setBehavior(val);
          if (app) {
            app.updateEntityAIBehavior(targetId, val);
            onCommit(t('history.aiChange'));
          }
        }}
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
};
