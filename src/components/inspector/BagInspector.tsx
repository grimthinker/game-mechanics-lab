import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { BagFormFields, BagFormValues } from '../modals/forms/FormFields';
import { t } from '../../locales';

export interface BagInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const BagInspector: React.FC<BagInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const inv = world.getComponent(targetId, 'inventory');
  const item = world.getComponent(targetId, 'item');
  const meta = world.getComponent(targetId, 'meta');

  const [bagData, setBagData] = useState<BagFormValues | null>(null);

  useEffect(() => {
    const i = world.getComponent(targetId, 'inventory');
    const it = world.getComponent(targetId, 'item');
    const m = world.getComponent(targetId, 'meta');

    if (i) {
      setBagData({
        name: m?.name ?? it?.name ?? 'Инвентарь',
        size: it?.size ?? 10,
        equipTypes: it?.equipTypes ?? ['torso'],
        equippable: it?.equippable ?? true,
        equipTimeMultiplier: it?.equipTimeMultiplier ?? 1.0,
        width: i.size.width,
        height: i.size.height,
      });
    } else {
      setBagData(null);
    }
  }, [targetId, world]);

  if (!inv || !bagData) return null;

  const isBagEmpty = inv.slots.every((r) => r.every((c) => !c.itemId));

  const handleChange = (patch: Partial<BagFormValues>) => {
    const updated = { ...bagData, ...patch };
    setBagData(updated);
    if (app) {
      app.mutations.updateEntityBag(targetId, updated, isBagEmpty);
      onCommit(t('history.bagChange'));
    }
  };

  return (
    <BagFormFields
      values={bagData}
      onChange={handleChange}
      isReadOnly={isReadOnly}
      isBagInventoryEmpty={isBagEmpty}
    />
  );
};
