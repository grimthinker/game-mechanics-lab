import React from 'react';

export interface StealthInspectorValues {
  stealthPower: number;
  crouchStealthMultiplier: number;
  runStealthMultiplier: number;
}

export interface StealthInspectorProps {
  values: StealthInspectorValues;
  onChange: (patch: Partial<StealthInspectorValues>) => void;
  isReadOnly?: boolean;
}

export const StealthInspector: React.FC<StealthInspectorProps> = ({ values, onChange, isReadOnly }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        Скрытность (Stealth Power):
        <input
          disabled={isReadOnly}
          type="number"
          value={values.stealthPower}
          min={0}
          max={1000}
          step={1}
          onChange={(e) => onChange({ stealthPower: Math.round(Number(e.target.value)) })}
        />
      </label>
      <label>
        Множитель скрытности присяда:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.crouchStealthMultiplier}
          min={1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ crouchStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
      <label>
        Множитель скрытности при беге:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.runStealthMultiplier}
          min={0}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ runStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
    </div>
  );