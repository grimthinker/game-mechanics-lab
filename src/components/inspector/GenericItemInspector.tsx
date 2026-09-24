import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { CommonItemFormFields } from '../modals/forms/FormFields';
import { t } from '../../locales';

export interface GenericItemInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const GenericItemInspector: React.FC<GenericItemInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const item = world.getComponent(targetId, 'item');
  const [data, setData] = useState<{
    size: number;
    equipTypes: string[];
    equippable: boolean;
    equipTimeMultiplier: number;
  } | null>(null);

  useEffect(() => {
    const it = world.getComponent(targetId, 'item');
    if (it && it.type === 'bodyPart') {
      setData({
        size: it.size,
        equipTypes: it.equipTypes,
        equippable: it.equippable,
        equipTimeMultiplier: it.equipTimeMultiplier,
      });
    } else {
      setData(null);
    }
  }, [targetId, world]);

  if (!item || !data) return null;

  const handleChange = (patch: any) => {
    const updated = { ...data, ...patch };
    setData(updated);
    if (app) {
      app.mutations.updateEntityGenericItem(targetId, updated);
      onCommit(t('history.genericItemChange'));
    }
  };

  return <CommonItemFormFields values={data} onChange={handleChange} isReadOnly={isReadOnly} />;
};
