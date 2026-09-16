import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { ZoneEffectType } from '../../ecs/types';
import { t } from '../../locales';

export interface AreaEffectorInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const AreaEffectorInspector: React.FC<AreaEffectorInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const effector = world.getComponent(targetId, 'areaEffector');
  const [values, setValues] = useState<any>(effector ? { ...effector } : null);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'areaEffector');
    if (comp) setValues({ ...comp });
    else setValues(null);
  }, [targetId, world]);

  if (!effector || !values) return null;

  const handleChange = (patch: any) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (app) {
      app.updateEntityAreaEffector(targetId, patch);
      onCommit(t('history.effectorChange'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        Тип эффекта зоны:
        <select
          disabled={isReadOnly}
          value={values.effect}
          onChange={(e) => handleChange({ effect: e.target.value as ZoneEffectType })}
        >
          <option value="damage">Урон (Лава / Огонь / Яд)</option>
          <option value="heal">Лечение (Источник жизни)</option>
          <option value="repel">Отталкивание (Силовое поле)</option>
          <option value="attract">Притягивание (Воронка / Гравитация)</option>
          <option value="time_dilation">Искажение времени (Множитель)</option>
        </select>
      </label>

      {(!values.distanceAttenuation || values.effect === 'damage' || values.effect === 'heal') && (
        <label>
          {values.effect === 'time_dilation'
            ? 'Множитель времени (0.5 = 50%):'
            : values.effect === 'damage' || values.effect === 'heal'
              ? 'Сила эффекта (HP / сек):'
              : 'Базовая сила импульса:'}
          <input
            disabled={isReadOnly}
            type="number"
            value={values.valuePerSec}
            min={0.01}
            max={2000}
            step={values.effect === 'time_dilation' ? 0.05 : 5}
            onChange={(e) => handleChange({ valuePerSec: Number(e.target.value) })}
          />
        </label>
      )}

      {(values.effect === 'repel' ||
        values.effect === 'attract' ||
        values.effect === 'time_dilation') && (
        <>
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
              checked={values.distanceAttenuation ?? false}
              onChange={(e) => handleChange({ distanceAttenuation: e.target.checked })}
            />
            {values.effect === 'time_dilation'
              ? 'Плавный градиент времени (от центра к краю)'
              : 'Зависимость силы от расстояния (Линейная)'}
          </label>

          {values.distanceAttenuation && (
            <>
              <label>
                {values.effect === 'time_dilation'
                  ? 'Множитель в центре (напр. 0.2x):'
                  : 'Сила в центре:'}
                <input
                  disabled={isReadOnly}
                  type="number"
                  value={values.centerValue ?? (values.effect === 'time_dilation' ? 0.2 : 150)}
                  min={0}
                  max={2000}
                  step={values.effect === 'time_dilation' ? 0.05 : 10}
                  onChange={(e) => handleChange({ centerValue: Number(e.target.value) })}
                />
              </label>
              <label>
                {values.effect === 'time_dilation'
                  ? 'Множитель на границе (напр. 1.0x):'
                  : 'Сила на границе:'}
                <input
                  disabled={isReadOnly}
                  type="number"
                  value={values.boundaryValue ?? (values.effect === 'time_dilation' ? 1.0 : 30)}
                  min={0}
                  max={2000}
                  step={values.effect === 'time_dilation' ? 0.05 : 10}
                  onChange={(e) => handleChange({ boundaryValue: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </>
      )}

      <label>
        Радиус зоны (px):
        <input
          disabled={isReadOnly}
          type="number"
          value={values.radius}
          min={20}
          max={2000}
          step={10}
          onChange={(e) => handleChange({ radius: Math.max(10, Number(e.target.value)) })}
        />
      </label>

      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
            checked={values.ignoreParent ?? true}
            onChange={(e) => handleChange({ ignoreParent: e.target.checked })}
          />
          Иммунитет носителя ауры (не действовать на владельца)
        </label>

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
            checked={values.destroyOnParentDeath ?? false}
            onChange={(e) => handleChange({ destroyOnParentDeath: e.target.checked })}
          />
          Удалять при гибели носителя
        </label>

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
            checked={values.destroyOnParentRemoval ?? true}
            onChange={(e) => handleChange({ destroyOnParentRemoval: e.target.checked })}
          />
          Удалять при удалении носителя из мира
        </label>
      </div>
    </div>
  );
};
