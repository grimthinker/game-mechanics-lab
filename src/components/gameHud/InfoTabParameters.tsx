import React from 'react';
import { World } from '../../ecs/World';
import { t } from '../../locales';

import { useState, useEffect } from 'react';
import { GAMEPLAY_CONFIG } from '../../config/gameplayConfig';

export interface InfoTabParametersProps {
  world: World;
  targetId: string;
  isCurrentlySelected: boolean;
}

export const InfoTabParameters: React.FC<InfoTabParametersProps> = ({
  world,
  targetId,
  isCurrentlySelected,
}) => {
  const captureSnapshot = () => {
    const physStats = world.getComponent(targetId, 'physicsStats');
    const meta = world.getComponent(targetId, 'meta');
    const velocity = world.getComponent(targetId, 'velocity');
    const stealthStats = world.getComponent(targetId, 'stealthStats');
    const tag = world.getComponent(targetId, 'tag');
    const isCreature = tag?.archetype === 'creature' || !!meta?.stance;

    const radius = physStats ? physStats.radius.current.toFixed(2) : '—';
    const height = physStats?.height ? physStats.height.current.toFixed(2) : '—';
    const weight = physStats ? (physStats.totalWeight ?? physStats.weight.current).toFixed(1) : '—';

    const paramRows: Array<{ label: string; value: string }> = [
      {
        label: t('interaction.params.radius'),
        value: `${radius} ${t('interaction.params.meterUnit')}`,
      },
      {
        label: t('interaction.params.height'),
        value: `${height} ${t('interaction.params.meterUnit')}`,
      },
      {
        label: t('interaction.params.weight'),
        value: `${weight} ${t('interaction.params.kgUnit')}`,
      },
    ];

    if (isCreature) {
      const stance = meta?.stance || 'standing';
      const movementMode = meta?.movementMode || 'immobile';
      const actionMode = meta?.actionMode || 'idle';
      const speed = velocity
        ? (velocity.actualSpeed ?? velocity.currentSpeed ?? 0).toFixed(2)
        : '0.00';
      const stealth = stealthStats ? Math.round(stealthStats.stealthPower.current).toString() : '—';

      paramRows.push(
        { label: t('interaction.params.stance'), value: stance },
        { label: t('interaction.params.movementMode'), value: movementMode },
        { label: t('interaction.params.actionMode'), value: actionMode },
        {
          label: t('interaction.params.speed'),
          value: `${speed} ${t('interaction.params.speedUnit')}`,
        },
        { label: t('interaction.params.stealth'), value: stealth }
      );
    }

    return paramRows;
  };

  const [rows, setRows] = useState(captureSnapshot);

  useEffect(() => {
    if (!isCurrentlySelected) return;

    setRows(captureSnapshot());

    const interval = setInterval(() => {
      setRows(captureSnapshot());
    }, GAMEPLAY_CONFIG.infoWindowUpdateInterval * 1000);

    return () => clearInterval(interval);
  }, [isCurrentlySelected, targetId, world]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: 1,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        paddingRight: '6px',
        boxSizing: 'border-box',
        scrollbarWidth: 'thin',
        scrollbarColor: '#383838 #757575',
      }}
    >
      {rows.map((row, idx) => (
        <div
          key={`param_${idx}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: idx % 2 === 0 ? '#b8b8b8' : 'transparent',
            borderRadius: '2px',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ color: '#222', fontWeight: 'bold' }}>{row.label}:</span>
          <span style={{ color: '#111', fontFamily: 'monospace' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
};
