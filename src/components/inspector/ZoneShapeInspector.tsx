import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { ZoneShapeType } from '../../ecs/components/zone';

export interface ZoneShapeInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const ZoneShapeInspector: React.FC<ZoneShapeInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const shape = world.getComponent(targetId, 'zoneShape');
  const [shapeType, setShapeType] = useState<ZoneShapeType>(shape?.shapeType ?? 'cylinder');
  const [radius, setRadius] = useState(shape?.radius ?? 2.5);
  const [height, setHeight] = useState(shape?.height ?? 2.5);
  const [width, setWidth] = useState(shape?.width ?? 5.0);
  const [depth, setDepth] = useState(shape?.depth ?? 5.0);

  useEffect(() => {
    const comp = world.getComponent(targetId, 'zoneShape');
    if (comp) {
      setShapeType(comp.shapeType);
      setRadius(comp.radius);
      setHeight(comp.height);
      setWidth(comp.width);
      setDepth(comp.depth);
    }
  }, [targetId, world]);

  if (!shape) return null;

  const handleUpdate = (patch: Partial<typeof shape>) => {
    if (patch.shapeType !== undefined) setShapeType(patch.shapeType);
    if (patch.radius !== undefined) setRadius(patch.radius);
    if (patch.height !== undefined) setHeight(patch.height);
    if (patch.width !== undefined) setWidth(patch.width);
    if (patch.depth !== undefined) setDepth(patch.depth);

    if (app) {
      app.mutations.updateEntityZoneShape(targetId, patch);
      onCommit('Изменение формы зоны');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Форма объема:</span>
        <select
          disabled={isReadOnly}
          value={shapeType}
          onChange={(e) => handleUpdate({ shapeType: e.target.value as ZoneShapeType })}
          style={{ width: '140px', padding: '3px' }}
        >
          <option value="cylinder">Цилиндр</option>
          <option value="sphere">Сфера</option>
          <option value="box">Параллелепипед</option>
        </select>
      </label>

      {(shapeType === 'sphere' || shapeType === 'cylinder') && (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Радиус (м):</span>
          <input
            disabled={isReadOnly}
            type="number"
            min={0.2}
            max={100}
            step={0.5}
            value={radius}
            onChange={(e) =>
              handleUpdate({ radius: Math.max(0.2, parseFloat(e.target.value) || 0.2) })
            }
            style={{ width: '80px', padding: '2px', textAlign: 'right' }}
          />
        </label>
      )}

      {(shapeType === 'cylinder' || shapeType === 'box') && (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Высота Y (м):</span>
          <input
            disabled={isReadOnly}
            type="number"
            min={0.2}
            max={100}
            step={0.5}
            value={height}
            onChange={(e) =>
              handleUpdate({ height: Math.max(0.2, parseFloat(e.target.value) || 0.2) })
            }
            style={{ width: '80px', padding: '2px', textAlign: 'right' }}
          />
        </label>
      )}

      {shapeType === 'box' && (
        <>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ширина X (м):</span>
            <input
              disabled={isReadOnly}
              type="number"
              min={0.2}
              max={200}
              step={0.5}
              value={width}
              onChange={(e) =>
                handleUpdate({ width: Math.max(0.2, parseFloat(e.target.value) || 0.2) })
              }
              style={{ width: '80px', padding: '2px', textAlign: 'right' }}
            />
          </label>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Глубина Z (м):</span>
            <input
              disabled={isReadOnly}
              type="number"
              min={0.2}
              max={200}
              step={0.5}
              value={depth}
              onChange={(e) =>
                handleUpdate({ depth: Math.max(0.2, parseFloat(e.target.value) || 0.2) })
              }
              style={{ width: '80px', padding: '2px', textAlign: 'right' }}
            />
          </label>
        </>
      )}
    </div>
  );
};
