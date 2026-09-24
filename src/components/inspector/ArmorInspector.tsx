import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { ArmorFormFields, ArmorFormValues } from '../modals/forms/FormFields';
import { t } from '../../locales';

export interface ArmorInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const ArmorInspector: React.FC<ArmorInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;
  const aStats = world.getComponent(targetId, 'armorStats');
  const item = world.getComponent(targetId, 'item');
  const meta = world.getComponent(targetId, 'meta');

  const [armorData, setArmorData] = useState<ArmorFormValues | null>(null);

  useEffect(() => {
    const s = world.getComponent(targetId, 'armorStats');
    const it = world.getComponent(targetId, 'item');
    const m = world.getComponent(targetId, 'meta');

    if (s) {
      setArmorData({
        name: m?.name ?? it?.name ?? 'Броня',
        size: it?.size ?? 20,
        equipTypes: it?.equipTypes ?? ['torso'],
        equippable: it?.equippable ?? true,
        equipTimeMultiplier: it?.equipTimeMultiplier ?? 1.0,
        defense: s.defense.base,
        flatReduction: s.flatReduction.base,
      });
    } else {
      setArmorData(null);
    }
  }, [targetId, world]);

  if (!aStats && currentArchetype !== 'creature') return null;

  const handleChange = (patch: Partial<ArmorFormValues>) => {
    const updated = {
      ...(armorData || {
        name: 'Броня',
        size: 10,
        equipTypes: [],
        equippable: true,
        equipTimeMultiplier: 1,
        defense: 0,
        flatReduction: 0,
      }),
      ...patch,
    };
    setArmorData(updated);
    if (app) {
      app.mutations.updateEntityArmor(targetId, updated);
      onCommit(t('history.armorChange'));
    }
  };

  return (
    <>
      {currentArchetype !== 'creature' && armorData && (
        <ArmorFormFields values={armorData} onChange={handleChange} isReadOnly={isReadOnly} />
      )}
      {currentArchetype === 'creature' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>
            Защита (defense):{' '}
            <input
              disabled={isReadOnly}
              type="number"
              value={armorData?.defense ?? 0}
              min={0}
              max={100}
              onChange={(e) => handleChange({ defense: Number(e.target.value) })}
            />
          </label>
          <label>
            Поглощение (flat reduction):{' '}
            <input
              disabled={isReadOnly}
              type="number"
              value={armorData?.flatReduction ?? 0}
              min={0}
              max={100}
              onChange={(e) => handleChange({ flatReduction: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </>
  );
};
