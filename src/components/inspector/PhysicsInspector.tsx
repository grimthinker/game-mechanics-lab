import React from 'react';
import { STANDARD_RADII, StandardRadius } from '../../ecs/types';

export interface PhysicsInspectorValues {
  radius: number;
  weight: number;
  isSolid: boolean;
}

export interface PhysicsInspectorProps {
  values: PhysicsInspectorValues;
  onChange: (patch: Partial<PhysicsInspectorValues>) => void;
  isReadOnly?: boolean;
  isStandardRadiusOnly?: boolean;
}

export const PhysicsInspector: React.FC<PhysicsInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
  isStandardRadiusOnly = false,
}) => (
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
        checked={values.isSolid}
        onChange={(e) => onChange({ isSolid: e.target.checked })}
      />
      Участвует в коллизии
    </label>

    <label>
      Радиус (px):
      {isStandardRadiusOnly ? (
        <select
          disabled={isReadOnly}
          value={values.radius}
          onChange={(e) => onChange({ radius: Number(e.target.value) as StandardRadius })}
        >
          {STANDARD_RADII.map((r) => (
            <option key={r} value={r}>
              {r} px
            </option>
          ))}
        </select>
      ) : (
        <input
          disabled={isReadOnly}
          type="number"
          value={values.radius}
          min={1}
          max={1000}
          step={1}
          onChange={(e) => onChange({ radius: Math.max(1, Number(e.target.value)) })}
        />
      )}
    </label>

    <label>
      Масса (Вес):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.weight}
        min={0.1}
        max={100}
        step={0.5}
        onChange={(e) => onChange({ weight: Math.round(Number(e.target.value) * 10) / 10 })}
      />
    </label>
  </div>
);
