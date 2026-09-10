import React from 'react';
import { Degrees } from '../../utils';

export interface MovementInspectorValues {
  maxSpeed: number;
  maxTurnSpeed: Degrees;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  walkSpeedMultiplier: number;
  runTurnMultiplier: number;
  crouchTurnMultiplier: number;
  strafeSpeedMultiplier: number;
  backwardSpeedMultiplier: number;
  strafeTurnMultiplier: number;
  backwardTurnMultiplier: number;
  pickupSpeedMultiplier: number;
  pickupTurnMultiplier: number;
}

export interface MovementInspectorProps {
  values: MovementInspectorValues;
  onChange: (patch: Partial<MovementInspectorValues>) => void;
  isReadOnly?: boolean;
}

export const MovementInspector: React.FC<MovementInspectorProps> = ({
  values,
  onChange,
  isReadOnly,
}) => (
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
        onChange={(e) =>
          onChange({ runSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
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
        onChange={(e) =>
          onChange({ crouchSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скорости замедленного шага:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.walkSpeedMultiplier}
        min={0.1}
        max={10}
        step={0.1}
        onChange={(e) =>
          onChange({ walkSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
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
        onChange={(e) =>
          onChange({ runTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
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
        onChange={(e) =>
          onChange({ crouchTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скорости стрейфа:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.strafeSpeedMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ strafeSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скорости движения назад:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.backwardSpeedMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ backwardSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель поворота при стрейфе:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.strafeTurnMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ strafeTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель поворота при движении назад:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.backwardTurnMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ backwardTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель скорости при подборе предмета:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.pickupSpeedMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ pickupSpeedMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
    <label>
      Множитель поворота при подборе предмета:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.pickupTurnMultiplier}
        min={0.1}
        max={10}
        step={0.05}
        onChange={(e) =>
          onChange({ pickupTurnMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
        }
      />
    </label>
  </div>
);
