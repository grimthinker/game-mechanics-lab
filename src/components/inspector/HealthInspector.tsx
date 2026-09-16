import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { t } from '../../locales';

export interface HealthInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const HealthInspector: React.FC<HealthInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const health = world.getComponent(targetId, 'health');
  const [hp, setHp] = useState(health ? Math.round(health.current) : 100);
  const [maxHp, setMaxHp] = useState(health ? Math.round(health.max.base) : 100);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    const comp = world.getComponent(targetId, 'health');
    if (comp) {
      setHp(Math.round(comp.current));
      setMaxHp(Math.round(comp.max.base));
    }
  }, [targetId, world]);

  if (!health) return null;

  const handleUpdate = (patch: { hp?: number; maxHp?: number }) => {
    const nextHp = patch.hp ?? hp;
    const nextMaxHp = patch.maxHp ?? maxHp;

    if (patch.hp !== undefined) setHp(nextHp);
    if (patch.maxHp !== undefined) setMaxHp(nextMaxHp);

    if (app) {
      app.updateEntityHealth(targetId, { hp: nextHp, maxHp: nextMaxHp });
      onCommit(t('history.healthChange'));
    }
  };

  const hpPercent = Math.max(0, Math.min(100, (hp / (maxHp || 1)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        {t('healthInspector.currentHp')}
        <input
          disabled={isReadOnly}
          type="number"
          value={hp}
          min={0}
          max={maxHp}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleUpdate({ hp: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('healthInspector.maxHp')}
        <input
          disabled={isReadOnly}
          type="number"
          value={maxHp}
          min={1}
          max={10000}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleUpdate({ maxHp: Number(e.target.value) })}
        />
      </label>
      <div
        style={{
          marginTop: '4px',
          height: '10px',
          backgroundColor: '#111',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            width: `${hpPercent}%`,
            height: '100%',
            backgroundColor: '#3498db',
            transition: 'width 0.2s',
          }}
        />
      </div>
    </div>
  );
};
