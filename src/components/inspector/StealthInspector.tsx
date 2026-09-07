import React from 'react';

export interface StealthInspectorValues {
  stealthPower: number;
  crouchStealthMultiplier: number;
  runStealthMultiplier: number;
  walkStealthMultiplier: number;
  turnInPlaceStealthMultiplier: number;
  immobileStealthMultiplier: number;
}

export interface StealthInspectorProps {
  values: StealthInspectorValues;
  onChange: (patch: Partial<StealthInspectorValues>) => void;
  isReadOnly?: boolean;
}

export const StealthInspector: React.FC<StealthInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
}) => (
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
        onChange={(e) =>
          onChange({ crouchStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скрытности при спринте:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.runStealthMultiplier}
        min={0}
        max={10}
        step={0.1}
        onChange={(e) =>
          onChange({ runStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скрытности при шаге:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.walkStealthMultiplier}
        min={0.1}
        max={10}
        step={0.1}
        onChange={(e) =>
          onChange({ walkStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скрытности при повороте на месте:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.turnInPlaceStealthMultiplier}
        min={0.1}
        max={10}
        step={0.1}
        onChange={(e) =>
          onChange({ turnInPlaceStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скрытности при неподвижности:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.immobileStealthMultiplier}
        min={0.1}
        max={10}
        step={0.1}
        onChange={(e) =>
          onChange({ immobileStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
  </div>
);
