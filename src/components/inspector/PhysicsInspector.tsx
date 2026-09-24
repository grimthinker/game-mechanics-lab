import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { calculateTotalEntityWeight } from '../../ecs/utils/hierarchy';
import { t } from '../../locales';

export interface PhysicsInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const PhysicsInspector: React.FC<PhysicsInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const physStats = world.getComponent(targetId, 'physicsStats');

  const [radius, setRadius] = useState(physStats ? physStats.radius.base : 16);
  const [weight, setWeight] = useState(physStats ? physStats.weight.base : 1);
  const [isSolid, setIsSolid] = useState(physStats ? physStats.isSolid : true);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    const comp = world.getComponent(targetId, 'physicsStats');
    if (comp) {
      setRadius(comp.radius.base);
      setWeight(comp.weight.base);
      setIsSolid(comp.isSolid);
    }
  }, [targetId, world]);

  if (!physStats) return null;

  const totalWeight = physStats.totalWeight ?? calculateTotalEntityWeight(world, targetId);

  const handleUpdate = (patch: { radius?: number; weight?: number; isSolid?: boolean }) => {
    const nextRadius = patch.radius ?? radius;
    const nextWeight = patch.weight ?? weight;
    const nextIsSolid = patch.isSolid ?? isSolid;

    if (patch.radius !== undefined) setRadius(nextRadius);
    if (patch.weight !== undefined) setWeight(nextWeight);
    if (patch.isSolid !== undefined) setIsSolid(nextIsSolid);

    if (app) {
      app.mutations.updateEntityPhysics(targetId, {
        radius: nextRadius,
        weight: nextWeight,
        isSolid: nextIsSolid,
      });
      onCommit(t('history.physicsChange'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: isReadOnly ? 'default' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          disabled={isReadOnly}
          checked={isSolid}
          onChange={(e) => handleUpdate({ isSolid: e.target.checked })}
        />
        {t('physicsInspector.isSolid')}
      </label>

      <label>
        {t('physicsInspector.radius')}
        <input
          disabled={isReadOnly}
          type="number"
          value={radius}
          min={0.05}
          max={50}
          step={0.05}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleUpdate({ radius: Math.max(0.05, Number(e.target.value)) })}
        />
      </label>

      <label>
        {t('physicsInspector.weight')}
        <input
          disabled={isReadOnly}
          type="number"
          value={weight}
          min={0.1}
          max={1000}
          step={0.5}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleUpdate({ weight: Math.round(Number(e.target.value) * 10) / 10 })}
        />
      </label>

      {totalWeight !== undefined && totalWeight !== weight && (
        <div
          style={{
            fontSize: '11px',
            color: '#3498db',
            display: 'flex',
            justifyContent: 'space-between',
            padding: '2px 4px',
            backgroundColor: '#16222f',
            borderRadius: '3px',
          }}
        >
          <span>{t('physicsInspector.totalWeight')}</span>
          <strong>{t('physicsInspector.weightKg', { weight: totalWeight })}</strong>
        </div>
      )}
    </div>
  );
};
