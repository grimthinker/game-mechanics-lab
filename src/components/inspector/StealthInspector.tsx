import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { Tooltip } from './Tooltip';
import { t } from '../../locales';

export interface StealthInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const StealthInspector: React.FC<StealthInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const st = world.getComponent(targetId, 'stealthStats');
  const [values, setValues] = useState<any>(null);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'stealthStats');
    if (comp) {
      setValues({
        stealthPower: comp.stealthPower.base,
        crouchStealthMultiplier: comp.crouchStealthMultiplier,
        proneStealthMultiplier: comp.proneStealthMultiplier ?? 3.0,
        runStealthMultiplier: comp.runStealthMultiplier,
        walkStealthMultiplier: comp.walkStealthMultiplier ?? 1.3,
        turnInPlaceStealthMultiplier: comp.turnInPlaceStealthMultiplier ?? 1.5,
        immobileStealthMultiplier: comp.immobileStealthMultiplier ?? 2.0,
      });
    } else {
      setValues(null);
    }
  }, [targetId, world]);

  if (!st || !values) return null;

  const handleChange = (patch: any) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (app) {
      app.updateEntityStealthStats(targetId, patch);
      onCommit(t('history.stealthChange'));
    }
  };

  return (
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
            onChange={(e) => handleChange({ stealthPower: Math.round(Number(e.target.value)) })}
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
              handleChange({
                crouchStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100,
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
              handleChange({
                proneStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100,
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
              handleChange({ runStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100 })
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
              handleChange({
                walkStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100,
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
              handleChange({
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
              handleChange({
                immobileStealthMultiplier: Math.round(Number(e.target.value) * 100) / 100,
              })
            }
          />
        </div>
      </label>
    </div>
  );
};
