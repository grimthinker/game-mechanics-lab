import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { WaterComponent, WaterBodyType } from '../../ecs/components/water';
import { t } from '../../locales';

export interface WaterInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const WaterInspector: React.FC<WaterInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const water = world.getComponent(targetId, 'water');
  const [values, setValues] = useState<WaterComponent | null>(water ? { ...water } : null);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'water');
    if (comp) setValues({ ...comp });
    else setValues(null);
  }, [targetId, world]);

  if (!water || !values) return null;

  const handleChange = (patch: Partial<WaterComponent>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (app) {
      app.mutations.updateEntityWater(targetId, patch);
      onCommit(t('history.waterChange'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Тип водоема:
        <select
          disabled={isReadOnly}
          value={values.waterType}
          onChange={(e) => handleChange({ waterType: e.target.value as WaterBodyType })}
          style={{ width: '130px', padding: '3px' }}
        >
          <option value="lake">Озеро (Стоячая)</option>
          <option value="river">Река (Течение)</option>
        </select>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
          Ширина X (м):
          <input
            disabled={isReadOnly}
            type="number"
            value={values.width}
            min={1}
            max={500}
            step={1}
            onChange={(e) => handleChange({ width: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
          Длина Z (м):
          <input
            disabled={isReadOnly}
            type="number"
            value={values.depth}
            min={1}
            max={500}
            step={1}
            onChange={(e) => handleChange({ depth: Math.max(1, Number(e.target.value)) })}
          />
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px' }}>Цвет воды:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            disabled={isReadOnly}
            type="color"
            value={values.color}
            onChange={(e) => handleChange({ color: e.target.value })}
            style={{
              width: '32px',
              height: '24px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
            }}
          />
          <input
            disabled={isReadOnly}
            type="text"
            value={values.color}
            onChange={(e) => handleChange({ color: e.target.value })}
            style={{ width: '70px', padding: '2px 4px', fontSize: '11px' }}
          />
        </div>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Прозрачность:</span>
          <span style={{ color: '#3498db' }}>{Math.round(values.opacity * 100)}%</span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={values.opacity}
          onChange={(e) => handleChange({ opacity: parseFloat(e.target.value) })}
          style={{ accentColor: '#3498db', cursor: 'pointer' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Высота волн:</span>
          <span style={{ color: '#2ecc71' }}>{values.waveHeight.toFixed(2)} м</span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0.0"
          max="0.5"
          step="0.01"
          value={values.waveHeight}
          onChange={(e) => handleChange({ waveHeight: parseFloat(e.target.value) })}
          style={{ accentColor: '#2ecc71', cursor: 'pointer' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Скорость волн:</span>
          <span style={{ color: '#f39c12' }}>{values.waveSpeed.toFixed(1)}x</span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0.2"
          max="5.0"
          step="0.1"
          value={values.waveSpeed}
          onChange={(e) => handleChange({ waveSpeed: parseFloat(e.target.value) })}
          style={{ accentColor: '#f39c12', cursor: 'pointer' }}
        />
      </label>

      {values.waterType === 'river' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            backgroundColor: '#1b1b1b',
            borderRadius: '4px',
            border: '1px solid #333',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1abc9c' }}>
            Параметры течения реки
          </span>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            Скорость потока (м/с):
            <input
              disabled={isReadOnly}
              type="number"
              min="0.0"
              max="15.0"
              step="0.2"
              value={values.flowSpeed}
              onChange={(e) =>
                handleChange({ flowSpeed: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              style={{ width: '60px', padding: '2px', textAlign: 'right' }}
            />
          </label>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            <span>Направление течения (X/Z):</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                disabled={isReadOnly}
                type="number"
                step="0.1"
                value={values.flowDirection.x}
                onChange={(e) =>
                  handleChange({
                    flowDirection: { ...values.flowDirection, x: parseFloat(e.target.value) || 0 },
                  })
                }
                style={{ width: '42px', padding: '2px', textAlign: 'right' }}
                title="Ось X"
              />
              <input
                disabled={isReadOnly}
                type="number"
                step="0.1"
                value={values.flowDirection.z}
                onChange={(e) =>
                  handleChange({
                    flowDirection: { ...values.flowDirection, z: parseFloat(e.target.value) || 0 },
                  })
                }
                style={{ width: '42px', padding: '2px', textAlign: 'right' }}
                title="Ось Z"
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
          Плотность (кг/м³):
          <input
            disabled={isReadOnly}
            type="number"
            value={values.density}
            min={100}
            max={3000}
            step={50}
            onChange={(e) => handleChange({ density: Number(e.target.value) })}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
          Вязкость среды:
          <input
            disabled={isReadOnly}
            type="number"
            value={values.viscosity}
            min={0.1}
            max={10.0}
            step={0.1}
            onChange={(e) => handleChange({ viscosity: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
};
