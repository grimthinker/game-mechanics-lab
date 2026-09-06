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
        <option value="damage">Урон (Лава / Яд)</option>
        <option value="heal">Лечение (Источник)</option>
      </select>
    </label>

    <label>
      Сила эффекта (HP / сек):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.valuePerSec}
        min={1}
        max={500}
        step={1}
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
        max={1000}
        step={10}
        onChange={(e) => onChange({ radius: Number(e.target.value) })}
      />
    </label>
  </div>
);