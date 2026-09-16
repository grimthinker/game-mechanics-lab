import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { STANDARD_RADII, StandardRadius } from '../../ecs/types';
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
  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;
  const isStandardRadiusOnly = currentArchetype === 'creature';
  const physStats = world.getComponent(targetId, 'physicsStats');

  const [radius, setRadius] = useState(physStats ? physStats.radius.base : 16);
  const [weight, setWeight] = useState(physStats ? physStats.weight.base : 1);
  const [isSolid, setIsSolid] = useState(physStats ? physStats.isSolid : true);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'physicsStats');
    if (comp) {
      setRadius(comp.radius.base);
      setWeight(comp.weight.base);
      setIsSolid(comp.isSolid);
    }
  }, [targetId, world]);

  if (!physStats) return null;

  const totalWeight = calculateTotalEntityWeight(world, targetId);

  const handleUpdate = (patch: { radius?: number; weight?: number; isSolid?: boolean }) => {
    const nextRadius = patch.radius ?? radius;
    const nextWeight = patch.weight ?? weight;
    const nextIsSolid = patch.isSolid ?? isSolid;

    if (patch.radius !== undefined) setRadius(nextRadius);
    if (patch.weight !== undefined) setWeight(nextWeight);
    if (patch.isSolid !== undefined) setIsSolid(nextIsSolid);

    if (app) {
      app.updateEntityPhysics(targetId, {
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
        {isStandardRadiusOnly ? (
          <select
            disabled={isReadOnly}
            value={radius}
            onChange={(e) => handleUpdate({ radius: Number(e.target.value) as StandardRadius })}
          >
            {STANDARD_RADII.map((r) => (
              <option key={r} value={r}>
                {r} px
              </option>
            ))}
          </select>
        ) : (
          <input
            disabled={isReadOnly}
            type="number"
            value={radius}
            min={1}
            max={1000}
            step={1}
            onChange={(e) => handleUpdate({ radius: Math.max(1, Number(e.target.value)) })}
          />
        )}
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
