import React from 'react';
import { ZoneEffectType, ZoneTriggerComponent } from '../../ecs/types';

export interface TriggerZoneInspectorProps {
  values: ZoneTriggerComponent;
  onChange: (patch: Partial<ZoneTriggerComponent>) => void;
  isReadOnly?: boolean;
}

export const TriggerZoneInspector: React.FC<TriggerZoneInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label>
      Тип эффекта зоны:
      <select
        disabled={isReadOnly}
        value={values.effect}
        onChange={(e) => onChange({ effect: e.target.value as ZoneEffectType })}
      >
        <option value="damage">Урон (Лава / Огонь / Яд)</option>
        <option value="heal">Лечение (Источник жизни)</option>
        <option value="repel">Отталкивание (Силовое поле)</option>
        <option value="attract">Притягивание (Воронка / Гравитация)</option>
      </select>
    </label>

    <label>
      {values.effect === 'damage' || values.effect === 'heal'
        ? 'Сила эффекта (HP / сек):'
        : 'Сила импульса (px / сек):'}
      <input
        disabled={isReadOnly}
        type="number"
        value={values.valuePerSec}
        min={1}
        max={2000}
        step={5}
        onChange={(e) => onChange({ valuePerSec: Number(e.target.value) })}
      />
    </label>

    <label>
      Радиус зоны (px):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.radius}
        min={20}
        max={2000}
        step={10}
        onChange={(e) => onChange({ radius: Math.max(10, Number(e.target.value)) })}
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
          onChange={(e) => onChange({ ignoreParent: e.target.checked })}
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
          onChange={(e) => onChange({ destroyOnParentDeath: e.target.checked })}
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
          onChange={(e) => onChange({ destroyOnParentRemoval: e.target.checked })}
        />
        Удалять при удалении носителя из мира
      </label>
    </div>
  </div>
);
