import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { t } from '../../locales';

export interface HeartInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const HeartInspector: React.FC<HeartInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const heart = world.getComponent(targetId, 'heart');
  const [requiresBrain, setRequiresBrain] = useState(heart?.requiresBrain ?? true);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'heart');
    if (comp) setRequiresBrain(comp.requiresBrain);
  }, [targetId, world]);

  if (!heart) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: isReadOnly ? 'default' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          disabled={isReadOnly}
          checked={requiresBrain}
          onChange={(e) => {
            const val = e.target.checked;
            setRequiresBrain(val);
            if (app) {
              app.updateEntityHeart(targetId, { requiresBrain: val });
              onCommit(t('history.heartChange'));
            }
          }}
        />
        {t('inspector.requiresBrain')}
      </label>
    </div>
  );
};
