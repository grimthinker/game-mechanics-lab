import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { rad2Deg, deg2Rad } from '../../utils';
import { t } from '../../locales';

export interface EnvironmentInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const EnvironmentInspector: React.FC<EnvironmentInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const env = world.getComponent(targetId, 'environment');

  const [timeOfDay, setTimeOfDay] = useState(env ? env.timeOfDay : 12.0);
  const [dayDuration, setDayDuration] = useState(env ? env.dayDuration : 600);
  const [azimuthDeg, setAzimuthDeg] = useState(env ? Math.round(rad2Deg(env.azimuth)) : 0);
  const [tiltDeg, setTiltDeg] = useState(env ? Math.round(rad2Deg(env.axialTilt)) : 23);
  const [fogDensity, setFogDensity] = useState(env ? env.fogDensity : 0.0012);
  const [ambientIntensity, setAmbientIntensity] = useState(env?.ambientIntensity ?? 0.65);
  const [sunIntensityMultiplier, setSunIntensityMultiplier] = useState(
    env?.sunIntensityMultiplier ?? 1.0
  );
  const [hemiSkyColor, setHemiSkyColor] = useState(env?.hemiSkyColor ?? '#c8dcff');
  const [hemiGroundColor, setHemiGroundColor] = useState(env?.hemiGroundColor ?? '#5c4a38');

  useEffect(() => {
    const comp = world.getComponent(targetId, 'environment');
    if (comp) {
      setTimeOfDay(comp.timeOfDay);
      setDayDuration(comp.dayDuration);
      setAzimuthDeg(Math.round(rad2Deg(comp.azimuth)));
      setTiltDeg(Math.round(rad2Deg(comp.axialTilt)));
      setFogDensity(comp.fogDensity);
      setAmbientIntensity(comp.ambientIntensity ?? 0.65);
      setSunIntensityMultiplier(comp.sunIntensityMultiplier ?? 1.0);
      setHemiSkyColor(comp.hemiSkyColor ?? '#c8dcff');
      setHemiGroundColor(comp.hemiGroundColor ?? '#5c4a38');
    }
  }, [targetId, world]);

  if (!env) return null;

  const handleUpdate = (patch: Partial<typeof env>, desc: string) => {
    if (patch.timeOfDay !== undefined) setTimeOfDay(patch.timeOfDay);
    if (patch.dayDuration !== undefined) setDayDuration(patch.dayDuration);
    if (patch.azimuth !== undefined) setAzimuthDeg(Math.round(rad2Deg(patch.azimuth)));
    if (patch.axialTilt !== undefined) setTiltDeg(Math.round(rad2Deg(patch.axialTilt)));
    if (patch.fogDensity !== undefined) setFogDensity(patch.fogDensity);
    if (patch.ambientIntensity !== undefined) setAmbientIntensity(patch.ambientIntensity);
    if (patch.sunIntensityMultiplier !== undefined)
      setSunIntensityMultiplier(patch.sunIntensityMultiplier);
    if (patch.hemiSkyColor !== undefined) setHemiSkyColor(patch.hemiSkyColor);
    if (patch.hemiGroundColor !== undefined) setHemiGroundColor(patch.hemiGroundColor);

    if (app) {
      app.mutations.updateEntityEnvironment(targetId, patch);
      onCommit(desc);
    }
  };

  const formatTime = (hoursFloat: number) => {
    const h = Math.floor(hoursFloat) % 24;
    const m = Math.floor((hoursFloat - Math.floor(hoursFloat)) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getSunIcon = (hoursFloat: number) => {
    if (hoursFloat >= 5 && hoursFloat < 8) return '🌅';
    if (hoursFloat >= 8 && hoursFloat < 17) return '☀️';
    if (hoursFloat >= 17 && hoursFloat < 21) return '🌇';
    return '🌙';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f39c12' }}>
            {getSunIcon(timeOfDay)} {t('environmentInspector.timeOfDay')}
          </span>
          <span
            style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}
          >
            {formatTime(timeOfDay)}
          </span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0.0"
          max="24.0"
          step="0.1"
          value={timeOfDay}
          onChange={(e) =>
            handleUpdate({ timeOfDay: parseFloat(e.target.value) }, t('history.environmentChange'))
          }
          style={{ accentColor: '#f39c12', cursor: 'pointer' }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
            marginTop: '2px',
          }}
        >
          {[
            { label: '06:00', icon: '🌅', val: 6.0 },
            { label: '12:00', icon: '☀️', val: 12.0 },
            { label: '18:00', icon: '🌇', val: 18.0 },
            { label: '00:00', icon: '🌙', val: 0.0 },
          ].map((preset) => (
            <button
              key={preset.label}
              disabled={isReadOnly}
              type="button"
              className="btn btn-sm"
              onClick={() =>
                handleUpdate({ timeOfDay: preset.val }, t('history.environmentChange'))
              }
              style={{
                fontSize: '10px',
                padding: '3px 0',
                backgroundColor: Math.abs(timeOfDay - preset.val) < 0.5 ? '#e67e22' : '#2c3e50',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              {preset.icon} {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
        }}
      >
        <span>{t('environmentInspector.dayDuration')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            disabled={isReadOnly}
            type="number"
            min="10"
            max="7200"
            step="10"
            value={dayDuration}
            onChange={(e) =>
              handleUpdate(
                { dayDuration: Math.max(10, parseInt(e.target.value, 10) || 600) },
                t('history.environmentChange')
              )
            }
            style={{ width: '60px', padding: '2px 4px', textAlign: 'right' }}
          />
          <span style={{ color: '#888' }}>
            {t('environmentInspector.secondsUnit')} ({Math.round(dayDuration / 60)}{' '}
            {t('environmentInspector.minutesUnit')})
          </span>
        </div>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>{t('environmentInspector.azimuth')}</span>
          <span style={{ color: '#3498db', fontWeight: 'bold' }}>{azimuthDeg}°</span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0"
          max="360"
          step="5"
          value={azimuthDeg}
          onChange={(e) =>
            handleUpdate(
              { azimuth: deg2Rad(parseInt(e.target.value, 10)) },
              t('history.environmentChange')
            )
          }
          style={{ accentColor: '#3498db', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>{t('environmentInspector.axialTilt')}</span>
          <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>{tiltDeg}°</span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="-60"
          max="60"
          step="1"
          value={tiltDeg}
          onChange={(e) =>
            handleUpdate(
              { axialTilt: deg2Rad(parseInt(e.target.value, 10)) },
              t('history.environmentChange')
            )
          }
          style={{ accentColor: '#9b59b6', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>{t('environmentInspector.fogDensity')}</span>
          <span style={{ color: '#1abc9c', fontWeight: 'bold' }}>
            {(fogDensity * 1000).toFixed(1)}
          </span>
        </div>
        <input
          disabled={isReadOnly}
          type="range"
          min="0.0005"
          max="0.0050"
          step="0.0001"
          value={fogDensity}
          onChange={(e) =>
            handleUpdate({ fogDensity: parseFloat(e.target.value) }, t('history.environmentChange'))
          }
          style={{ accentColor: '#1abc9c', cursor: 'pointer' }}
        />
      </div>

      {/* Раздел глобальной освещенности (GI) и мягкости теней */}
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
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f39c12' }}>
          {t('environmentInspector.globalLighting')}
        </span>

        {/* Яркость теней / фонового света */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>{t('environmentInspector.ambientIntensity')}</span>
            <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>
              {Math.round(ambientIntensity * 100)}%
            </span>
          </div>
          <input
            disabled={isReadOnly}
            type="range"
            min="0.1"
            max="1.5"
            step="0.05"
            value={ambientIntensity}
            onChange={(e) =>
              handleUpdate(
                { ambientIntensity: parseFloat(e.target.value) },
                t('history.environmentChange')
              )
            }
            style={{ accentColor: '#2ecc71', cursor: 'pointer' }}
          />
        </div>

        {/* Множитель яркости прямого солнечного света */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>{t('environmentInspector.sunIntensity')}</span>
            <span style={{ color: '#e67e22', fontWeight: 'bold' }}>
              {sunIntensityMultiplier.toFixed(2)}x
            </span>
          </div>
          <input
            disabled={isReadOnly}
            type="range"
            min="0.1"
            max="2.0"
            step="0.05"
            value={sunIntensityMultiplier}
            onChange={(e) =>
              handleUpdate(
                { sunIntensityMultiplier: parseFloat(e.target.value) },
                t('history.environmentChange')
              )
            }
            style={{ accentColor: '#e67e22', cursor: 'pointer' }}
          />
        </div>

        {/* Цвет верхнего рассеянного света неба */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px' }}>{t('environmentInspector.skyLightColor')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              disabled={isReadOnly}
              type="color"
              value={hemiSkyColor}
              onChange={(e) =>
                handleUpdate({ hemiSkyColor: e.target.value }, t('history.environmentChange'))
              }
              style={{
                width: '28px',
                height: '22px',
                cursor: 'pointer',
                border: 'none',
                background: 'none',
              }}
            />
            <input
              disabled={isReadOnly}
              type="text"
              value={hemiSkyColor}
              onChange={(e) =>
                handleUpdate({ hemiSkyColor: e.target.value }, t('history.environmentChange'))
              }
              style={{ width: '64px', padding: '2px 4px', fontSize: '11px' }}
            />
          </div>
        </div>

        {/* Цвет нижнего отраженного света земли */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px' }}>{t('environmentInspector.groundLightColor')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              disabled={isReadOnly}
              type="color"
              value={hemiGroundColor}
              onChange={(e) =>
                handleUpdate({ hemiGroundColor: e.target.value }, t('history.environmentChange'))
              }
              style={{
                width: '28px',
                height: '22px',
                cursor: 'pointer',
                border: 'none',
                background: 'none',
              }}
            />
            <input
              disabled={isReadOnly}
              type="text"
              value={hemiGroundColor}
              onChange={(e) =>
                handleUpdate({ hemiGroundColor: e.target.value }, t('history.environmentChange'))
              }
              style={{ width: '64px', padding: '2px 4px', fontSize: '11px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
