import React from 'react';
import { Degrees } from '../../utils';
import { Tooltip } from './Tooltip';

export interface MovementInspectorValues {
  maxSpeed: number;
  maxTurnSpeed: Degrees;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  proneSpeedMultiplier: number;
  walkSpeedMultiplier: number;
  runTurnMultiplier: number;
  crouchTurnMultiplier: number;
  proneTurnMultiplier: number;
  walkTurnMultiplier: number;
  turnInPlaceTurnMultiplier: number;
  strafeSpeedMultiplier: number;
  backwardSpeedMultiplier: number;
  strafeTurnMultiplier: number;
  backwardTurnMultiplier: number;
  pickupSpeedMultiplier: number;
  pickupTurnMultiplier: number;
  standToCrouchTime: number;
  crouchToStandTime: number;
  standToProneTime: number;
  proneToStandTime: number;
  crouchToProneTime: number;
  proneToCrouchTime: number;
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
            value={(values as any)[key]}
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
              onChange({ [key]: rounded });
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
                value={(values as any)[key]}
                min={0.01}
                max={5}
                step={0.05}
                style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
                onChange={(e) => onChange({ [key]: Number(e.target.value) })}
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  </div>
);
