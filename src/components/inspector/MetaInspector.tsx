import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { CreatureStance } from '../../ecs/types';
import { t } from '../../locales';

export interface MetaInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const MetaInspector: React.FC<MetaInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const meta = world.getComponent(targetId, 'meta');
  const item = world.getComponent(targetId, 'item');
  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;

  const [name, setName] = useState(meta?.name ?? item?.name ?? targetId);
  const [destructible, setDestructible] = useState(meta?.destructible ?? false);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    const m = world.getComponent(targetId, 'meta');
    const it = world.getComponent(targetId, 'item');
    setName(m?.name ?? it?.name ?? targetId);
    setDestructible(m?.destructible ?? false);
  }, [targetId, world]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (app) {
      app.updateEntityMeta(targetId, { name: val, destructible });
      onCommit(t('history.nameChange'));
    }
  };

  const handleDestructibleChange = (val: boolean) => {
    setDestructible(val);
    if (app) {
      app.updateEntityMeta(targetId, { name, destructible: val });
      onCommit(t('history.nameChange'));
    }
  };

  const getStanceLabel = (s?: CreatureStance) => {
    if (!s) return null;
    if (s === 'standing') return { text: t('hud.standing'), color: '#2980b9' };
    if (s === 'crouching') return { text: t('hud.crouching'), color: '#8e44ad' };
    if (s === 'prone') return { text: t('hud.prone'), color: '#795548' };
    return { text: `${t('hud.transition')} (${s})`, color: '#d35400' };
  };

  const stanceInfo = getStanceLabel(meta?.stance);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        {t('metaInspector.nameLabel')}
        <input
          disabled={isReadOnly}
          type="text"
          value={name}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </label>
      {stanceInfo && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <span>{t('metaInspector.currentStance')}</span>
          <span
            style={{
              backgroundColor: stanceInfo.color,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            {stanceInfo.text}
          </span>
        </div>
      )}
      {(currentArchetype === 'obstacle' || currentArchetype === 'item') && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: isReadOnly ? 'default' : 'pointer',
            margin: '4px 0',
          }}
        >
          <input
            type="checkbox"
            disabled={isReadOnly}
            checked={destructible}
            onChange={(e) => handleDestructibleChange(e.target.checked)}
          />
          {t('inspector.destructible')}
        </label>
      )}
      {world.getComponent(targetId, 'locomotion') && (
        <div
          style={{
            fontSize: '11px',
            color: '#f1c40f',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px',
            padding: '4px 6px',
            backgroundColor: '#1b1b1b',
            borderRadius: '4px',
            border: '1px solid #333',
          }}
        >
          <span>🦵</span>
          <span>{t('inspector.locomotion')}</span>
        </div>
      )}
    </div>
  );
};
