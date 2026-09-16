import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { rad2Deg, Degrees } from '../../utils';
import { Tooltip } from './Tooltip';
import { t } from '../../locales';

export interface MovementInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const MovementInspector: React.FC<MovementInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const ms = world.getComponent(targetId, 'movementStats');
  const [values, setValues] = useState<any>(null);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'movementStats');
    if (comp) {
      setValues({
        maxSpeed: comp.maxSpeed.base,
        maxTurnSpeed: rad2Deg(comp.maxTurnSpeed.base) as Degrees,
        runSpeedMultiplier: comp.runSpeedMultiplier,
        crouchSpeedMultiplier: comp.crouchSpeedMultiplier,
        proneSpeedMultiplier: comp.proneSpeedMultiplier ?? 0.2,
        walkSpeedMultiplier: comp.walkSpeedMultiplier ?? 0.5,
        runTurnMultiplier: comp.runTurnMultiplier ?? 0.7,
        crouchTurnMultiplier: comp.crouchTurnMultiplier,
        proneTurnMultiplier: comp.proneTurnMultiplier ?? 0.3,
        walkTurnMultiplier: comp.walkTurnMultiplier ?? 1.1,
        turnInPlaceTurnMultiplier: comp.turnInPlaceTurnMultiplier ?? 1.2,
        strafeSpeedMultiplier: comp.strafeSpeedMultiplier ?? 0.8,
        backwardSpeedMultiplier: comp.backwardSpeedMultiplier ?? 0.6,
        strafeTurnMultiplier: comp.strafeTurnMultiplier ?? 0.8,
        backwardTurnMultiplier: comp.backwardTurnMultiplier ?? 0.6,
        pickupSpeedMultiplier: comp.pickupSpeedMultiplier ?? 0.5,
        pickupTurnMultiplier: comp.pickupTurnMultiplier ?? 1.1,
        standToCrouchTime: comp.standToCrouchTime?.base ?? 0.1,
        crouchToStandTime: comp.crouchToStandTime?.base ?? 0.1,
        standToProneTime: comp.standToProneTime?.base ?? 0.5,
        proneToStandTime: comp.proneToStandTime?.base ?? 1.0,
        crouchToProneTime: comp.crouchToProneTime?.base ?? 0.5,
        proneToCrouchTime: comp.proneToCrouchTime?.base ?? 1.0,
      });
    } else {
      setValues(null);
    }
  }, [targetId, world]);

  if (!ms || !values) return null;

  const handleChange = (patch: any) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (app) {
      app.updateEntityMovementStats(targetId, patch);
      onCommit(t('history.movementChange'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
      {[
        {
          label: 'Макс. скорость (px/с):',
          key: 'maxSpeed',
          tooltip: 'Максимальная скорость передвижения (пикселей в секунду)',
          step: 10,
          max: 1000,
        },
        {
          label: 'Макс. скорость поворота (°/с):',
          key: 'maxTurnSpeed',
          tooltip: 'Максимальная скорость поворота корпуса (градусов в секунду)',
          step: 10,
          max: 1080,
        },
        {
          label: 'Множитель скорости бега:',
          key: 'runSpeedMultiplier',
          tooltip: 'Множитель скорости при беге / спринте',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель скорости присяда:',
          key: 'crouchSpeedMultiplier',
          tooltip: 'Множитель скорости в присяди',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель скорости лежа:',
          key: 'proneSpeedMultiplier',
          tooltip: 'Множитель скорости в положении лёжа',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель скорости шага:',
          key: 'walkSpeedMultiplier',
          tooltip: 'Множитель скорости при замедленном шаге',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель поворота при беге:',
          key: 'runTurnMultiplier',
          tooltip: 'Множитель скорости поворота при беге',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель поворота при шаге:',
          key: 'walkTurnMultiplier',
          tooltip: 'Множитель скорости поворота при шаге',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель поворота на месте:',
          key: 'turnInPlaceTurnMultiplier',
          tooltip: 'Множитель скорости поворота при вращении на месте',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель поворота в присяди:',
          key: 'crouchTurnMultiplier',
          tooltip: 'Множитель скорости поворота в присяди',
          step: 0.1,
          max: 10,
        },
        {
          label: 'Множитель поворота лежа:',
          key: 'proneTurnMultiplier',
          tooltip: 'Множитель скорости поворота в положении лёжа',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель скорости стрейфа:',
          key: 'strafeSpeedMultiplier',
          tooltip: 'Множитель скорости при движении вбок (стрейф)',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель скорости назад:',
          key: 'backwardSpeedMultiplier',
          tooltip: 'Множитель скорости при движении назад',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель поворота при стрейфе:',
          key: 'strafeTurnMultiplier',
          tooltip: 'Множитель поворота при стрейфе',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель поворота назад:',
          key: 'backwardTurnMultiplier',
          tooltip: 'Множитель поворота при движении назад',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель скорости подбора:',
          key: 'pickupSpeedMultiplier',
          tooltip: 'Множитель скорости при подборе предметов',
          step: 0.05,
          max: 10,
        },
        {
          label: 'Множитель поворота подбора:',
          key: 'pickupTurnMultiplier',
          tooltip: 'Множитель поворота при подборе предметов',
          step: 0.05,
          max: 10,
        },
      ].map(({ label, key, tooltip, step, max }) => (
        <label
          key={key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            gap: '8px',
          }}
        >
          <span style={{ color: '#ecf0f1', flex: 1 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Tooltip text={tooltip} />
            <input
              disabled={isReadOnly}
              type="number"
              value={values[key]}
              min={0}
              max={max}
              step={step}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                const rounded =
                  step < 0.1
                    ? Math.round(val * 100) / 100
                    : step === 0.1
                      ? Math.round(val * 10) / 10
                      : Math.round(val);
                handleChange({ [key]: rounded });
              }}
            />
          </div>
        </label>
      ))}

      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3498db' }}>
          Время переходов (сек):
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          {[
            {
              label: 'Стоя → Присед:',
              key: 'standToCrouchTime',
              tooltip: 'Время перехода из стойки стоя в присед',
            },
            {
              label: 'Присед → Стоя:',
              key: 'crouchToStandTime',
              tooltip: 'Время перехода из приседа в стойку стоя',
            },
            {
              label: 'Стоя → Лежа:',
              key: 'standToProneTime',
              tooltip: 'Время перехода из стойки стоя в положение лежа',
            },
            {
              label: 'Лежа → Стоя:',
              key: 'proneToStandTime',
              tooltip: 'Время подъема из положения лежа в стойку стоя',
            },
            {
              label: 'Присед → Лежа:',
              key: 'crouchToProneTime',
              tooltip: 'Время перехода из приседа в положение лежа',
            },
            {
              label: 'Лежа → Присед:',
              key: 'proneToCrouchTime',
              tooltip: 'Время перехода из положения лежа в присед',
            },
          ].map(({ label, key, tooltip }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                gap: '8px',
              }}
            >
              <span style={{ color: '#ecf0f1', flex: 1 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Tooltip text={tooltip} />
                <input
                  disabled={isReadOnly}
                  type="number"
                  value={values[key]}
                  min={0.01}
                  max={5}
                  step={0.05}
                  style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
                  onChange={(e) => handleChange({ [key]: Number(e.target.value) })}
                />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
