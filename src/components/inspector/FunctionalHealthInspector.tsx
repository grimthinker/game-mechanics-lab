import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { t } from '../../locales';

export interface FunctionalHealthInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const FunctionalHealthInspector: React.FC<FunctionalHealthInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const fpComp = world.getComponent(targetId, 'functionalHealth');
  const [fp, setFp] = useState(fpComp ? Math.round(fpComp.current) : 0);
  const [maxFp, setMaxFp] = useState(fpComp ? Math.round(fpComp.max.base) : 100);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'functionalHealth');
    if (comp) {
      setFp(Math.round(comp.current));
      setMaxFp(Math.round(comp.max.base));
    }
  }, [targetId, world]);

  if (!fpComp) return null;

  const minFp = -2 * maxFp;
  const totalRange = maxFp - minFp;
  const percent = Math.max(0, Math.min(100, ((fp - minFp) / totalRange) * 100));

  let color = '#2ecc71';
  let statusText = t('inspector.statusFunctional');
  if (fp <= 0 && fp > -maxFp) {
    color = '#f39c12';
    statusText = t('inspector.statusDisabled');
  } else if (fp <= -maxFp) {
    color = '#e74c3c';
    statusText = t('inspector.statusCritical');
  }

  const handleFpChange = (newFp: number) => {
    setFp(newFp);
    if (app) {
      app.mutations.updateEntityFunctionalHealth(targetId, { fp: newFp });
      onCommit(t('history.fpChange'));
    }
  };

  const handleMaxFpChange = (newMaxFp: number) => {
    setMaxFp(newMaxFp);
    if (app) {
      app.mutations.updateEntityFunctionalHealth(targetId, { maxFp: newMaxFp });
      onCommit(t('history.fpChange'));
    }
  };

  return (
    <>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Текущая ФП (от {minFp} до {maxFp}):
        <input
          disabled={isReadOnly}
          type="number"
          value={fp}
          min={minFp}
          max={maxFp}
          onChange={(e) => handleFpChange(Number(e.target.value))}
        />
      </label>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '6px',
        }}
      >
        Макс. ФП:
        <input
          disabled={isReadOnly}
          type="number"
          value={maxFp}
          min={1}
          max={10000}
          onChange={(e) => handleMaxFpChange(Number(e.target.value))}
        />
      </label>

      <div
        style={{
          marginTop: '10px',
          height: '12px',
          backgroundColor: '#111',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #333',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(maxFp / totalRange) * 100}%`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: '#fff',
            zIndex: 2,
          }}
          title="0 (Порог отключения)"
        />
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.2s, background-color 0.2s',
          }}
        />
      </div>

      <div
        style={{
          fontSize: '11px',
          color,
          marginTop: '6px',
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        Статус: {statusText}
      </div>
    </>
  );
};
