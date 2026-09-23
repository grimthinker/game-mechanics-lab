import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { CreatureStance } from '../../ecs/types';
import { rad2Deg, deg2Rad } from '../../utils';
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
  const transform = world.getComponent(targetId, 'transform');
  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;

  const [name, setName] = useState(meta?.name ?? item?.name ?? targetId);
  const [destructible, setDestructible] = useState(meta?.destructible ?? false);
  const [posX, setPosX] = useState(transform ? Number(transform.x.toFixed(2)) : 0);
  const [posY, setPosY] = useState(transform ? Number(transform.y.toFixed(2)) : 0);
  const [posZ, setPosZ] = useState(transform ? Number(transform.z.toFixed(2)) : 0);
  const [yawDeg, setYawDeg] = useState(transform ? Math.round(rad2Deg(transform.angle ?? 0)) : 0);

  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    const m = world.getComponent(targetId, 'meta');
    const it = world.getComponent(targetId, 'item');
    const tr = world.getComponent(targetId, 'transform');

    setName(m?.name ?? it?.name ?? targetId);
    setDestructible(m?.destructible ?? false);

    if (tr) {
      setPosX(Number(tr.x.toFixed(2)));
      setPosY(Number(tr.y.toFixed(2)));
      setPosZ(Number(tr.z.toFixed(2)));
      setYawDeg(Math.round(rad2Deg(tr.angle ?? 0)));
    }
  }, [targetId, world]);

  const handleTransformChange = (patch: { x?: number; y?: number; z?: number; angle?: number }) => {
    if (patch.x !== undefined) setPosX(patch.x);
    if (patch.y !== undefined) setPosY(patch.y);
    if (patch.z !== undefined) setPosZ(patch.z);
    if (patch.angle !== undefined) setYawDeg(Math.round(rad2Deg(patch.angle)));

    if (app) {
      app.updateEntityTransform(targetId, patch);
      onCommit('Изменение координат');
    }
  };

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
    if (s === 'airborne') return { text: t('hud.airborne'), color: '#00bcd4' };
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
      {/* 3D Трансформация объекта */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          backgroundColor: '#1b1b1b',
          borderRadius: '4px',
          border: '1px solid #333',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3498db' }}>
          Координаты (метры)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <label style={{ fontSize: '10px', color: '#e74c3c' }}>
            X:
            <input
              disabled={isReadOnly}
              type="number"
              step="0.1"
              value={posX}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => handleTransformChange({ x: parseFloat(e.target.value) || 0 })}
              style={{
                width: '100%',
                padding: '2px 4px',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </label>
          <label style={{ fontSize: '10px', color: '#2ecc71' }}>
            Y (Высота):
            <input
              disabled={isReadOnly}
              type="number"
              step="0.1"
              value={posY}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => handleTransformChange({ y: parseFloat(e.target.value) || 0 })}
              style={{
                width: '100%',
                padding: '2px 4px',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </label>
          <label style={{ fontSize: '10px', color: '#3498db' }}>
            Z:
            <input
              disabled={isReadOnly}
              type="number"
              step="0.1"
              value={posZ}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => handleTransformChange({ z: parseFloat(e.target.value) || 0 })}
              style={{
                width: '100%',
                padding: '2px 4px',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </label>
        </div>
        <label
          style={{
            fontSize: '10px',
            color: '#f1c40f',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          Поворот Yaw (°):
          <input
            disabled={isReadOnly}
            type="number"
            step="5"
            value={yawDeg}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
            }}
            onChange={(e) =>
              handleTransformChange({ angle: deg2Rad(parseFloat(e.target.value) || 0) })
            }
            style={{ width: '60px', padding: '2px 4px', fontSize: '11px', textAlign: 'right' }}
          />
        </label>
      </div>

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
