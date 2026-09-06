import React from 'react';
import { Degrees } from '../../utils';

export interface MovementInspectorValues {
  maxSpeed: number;
  maxTurnSpeed: Degrees;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  runTurnMultiplier: number;
  crouchTurnMultiplier: number;
}

export interface MovementInspectorProps {
  values: MovementInspectorValues;
  onChange: (patch: Partial<MovementInspectorValues>) => void;
  isReadOnly?: boolean;
}

export const MovementInspector: React.FC<MovementInspectorProps> = ({ values, onChange, isReadOnly }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        Макс. скорость (px/с):
        <input
          disabled={isReadOnly}
          type="number"
          value={values.maxSpeed}
          min={0}
          max={1000}
          step={10}
          onChange={(e) => onChange({ maxSpeed: Math.round(Number(e.target.value)) })}
        />
      </label>
      <label>
        Макс. скорость поворота (°/с):
        <input
          disabled={isReadOnly}
          type="number"
          value={values.maxTurnSpeed}
          min={0}
          max={1080}
          step={10}
          onChange={(e) => onChange({ maxTurnSpeed: Math.round(Number(e.target.value)) as Degrees })}
        />
      </label>
      <label>
        Множитель скорости бега:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.runSpeedMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ runSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
      <label>
        Множитель скорости присяда:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.crouchSpeedMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ crouchSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
      <label>
        Множитель поворота при беге:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.runTurnMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ runTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
      <label>
        Множитель поворота в присяди:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.crouchTurnMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ crouchTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })}
        />
      </label>
    </div>
  );