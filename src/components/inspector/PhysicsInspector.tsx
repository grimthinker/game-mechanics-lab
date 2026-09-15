import React from 'react';
import { STANDARD_RADII, StandardRadius } from '../../ecs/types';
import { t } from '../../locales';

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
  totalWeight?: number;
}

export const PhysicsInspector: React.FC<PhysicsInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
  isStandardRadiusOnly = false,
  totalWeight,
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
      {t('physicsInspector.isSolid')}
    </label>

    <label>
      {t('physicsInspector.radius')}
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
      {t('physicsInspector.weight')}
      <input
        disabled={isReadOnly}
        type="number"
        value={values.weight}
        min={0.1}
        max={1000}
        step={0.5}
        onChange={(e) => onChange({ weight: Math.round(Number(e.target.value) * 10) / 10 })}
      />
    </label>

    {totalWeight !== undefined && totalWeight !== values.weight && (
      <div
        style={{
          fontSize: '11px',
          color: '#3498db',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 4px',
          backgroundColor: '#16222f',
          borderRadius: '3px',
        }}
      >
        <span>{t('physicsInspector.totalWeight')}</span>
        <strong>{t('physicsInspector.weightKg', { weight: totalWeight })}</strong>
      </div>
    )}
  </div>
);
