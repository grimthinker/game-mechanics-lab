import React from 'react';
import { Tooltip } from './Tooltip';

export interface StealthInspectorValues {
  stealthPower: number;
  crouchStealthMultiplier: number;
  proneStealthMultiplier: number;
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
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Скрытность (Stealth Power):</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Базовый показатель скрытности персонажа" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.stealthPower}
          min={0}
          max={1000}
          step={1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) => onChange({ stealthPower: Math.round(Number(e.target.value)) })}
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель присяда:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки в присяди" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.crouchStealthMultiplier}
          min={1}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({ crouchStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
          }
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель лёжа (prone):</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки в положении лежа" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.proneStealthMultiplier}
          min={1}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({ proneStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
          }
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель спринта:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки при беге (снижает скрытность)" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.runStealthMultiplier}
          min={0}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({ runStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
          }
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель шага:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки при замедленном шаге" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.walkStealthMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({ walkStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
          }
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель поворота на месте:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки при вращении на месте" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.turnInPlaceStealthMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({
              turnInPlaceStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100,
            })
          }
        />
      </div>
    </label>

    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      <span style={{ color: '#ecf0f1', flex: 1 }}>Множитель неподвижности:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Tooltip text="Коэффициент маскировки, когда персонаж стоит неподвижно" />
        <input
          disabled={isReadOnly}
          type="number"
          value={values.immobileStealthMultiplier}
          min={0.1}
          max={10}
          step={0.1}
          style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
          onChange={(e) =>
            onChange({ immobileStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
          }
        />
      </div>
    </label>
  </div>
);
