import React from 'react';

export interface HealthInspectorValues {
  hp: number;
  maxHp: number;
}

export interface HealthInspectorProps {
  values: HealthInspectorValues;
  onChange: (patch: Partial<HealthInspectorValues>) => void;
  isReadOnly?: boolean;
}

export const HealthInspector: React.FC<HealthInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label>
      Текущее HP:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.hp}
        min={0}
        max={values.maxHp}
        onChange={(e) => onChange({ hp: Number(e.target.value) })}
      />
    </label>
    <label>
      Базовое макс. HP:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.maxHp}
        min={1}
        max={10000}
        onChange={(e) => onChange({ maxHp: Number(e.target.value) })}
      />
    </label>
  </div>
);
