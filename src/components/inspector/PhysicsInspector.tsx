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
  const tag = world.getComponent(targetId, 'tag');
  const meta = world.getComponent(targetId, 'meta');
  const isObstacle = tag?.archetype === 'obstacle' || meta?.entityType === 'obstacle';

  const [radius, setRadius] = useState(physStats ? physStats.radius.base : 16);
  const [height, setHeight] = useState(physStats?.height ? physStats.height.base : 1.8);
  const [weight, setWeight] = useState(physStats ? physStats.weight.base : 1);
  const [isSolid, setIsSolid] = useState(physStats ? physStats.isSolid : true);

  const getDims = (stats: typeof physStats) => {
    if (!stats) return { w: 2.0, d: 2.0 };
    if (stats.points && stats.points.length > 0) {
      let minX = stats.points[0].x,
        maxX = stats.points[0].x;
      let minY = stats.points[0].y,
        maxY = stats.points[0].y;
      for (let i = 1; i < stats.points.length; i++) {
        const p = stats.points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return {
        w: Math.max(0.1, Math.round((maxX - minX) * 100) / 100),
        d: Math.max(0.1, Math.round((maxY - minY) * 100) / 100),
      };
    }
    const r = stats.radius.base || 1;
    return { w: Math.round(r * 2 * 100) / 100, d: Math.round(r * 2 * 100) / 100 };
  };

  const initialDims = getDims(physStats);
  const [width, setWidth] = useState(initialDims.w);
  const [depth, setDepth] = useState(initialDims.d);
  const [keepAspect, setKeepAspect] = useState<boolean>(true);

  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    const comp = world.getComponent(targetId, 'physicsStats');
    if (comp) {
      setRadius(comp.radius.base);
      if (comp.height) setHeight(comp.height.base);
      setWeight(comp.weight.base);
      setIsSolid(comp.isSolid);

      const d = getDims(comp);
      setWidth(d.w);
      setDepth(d.d);
    }
  }, [targetId, world]);

  if (!physStats) return null;

  const totalWeight = physStats.totalWeight ?? calculateTotalEntityWeight(world, targetId);

  const handleUpdate = (patch: {
    radius?: number;
    width?: number;
    depth?: number;
    height?: number;
    weight?: number;
    isSolid?: boolean;
  }) => {
    if (patch.radius !== undefined) setRadius(patch.radius);
    if (patch.height !== undefined) setHeight(patch.height);
    if (patch.weight !== undefined) setWeight(patch.weight);
    if (patch.isSolid !== undefined) setIsSolid(patch.isSolid);

    if (app) {
      app.mutations.updateEntityPhysics(targetId, {
        radius: patch.radius,
        width: patch.width,
        depth: patch.depth,
        height: patch.height,
        weight: patch.weight,
        isSolid: patch.isSolid,
      });
      onCommit(t('history.physicsChange'));
    }
  };

  const handleWidthChange = (newW: number) => {
    const clampedW = Math.max(0.1, Math.round(newW * 100) / 100);
    setWidth(clampedW);

    if (keepAspect && width > 0) {
      const aspect = depth / width;
      const newD = Math.max(0.1, Math.round(clampedW * aspect * 100) / 100);
      setDepth(newD);
      handleUpdate({ width: clampedW, depth: newD });
    } else {
      handleUpdate({ width: clampedW, depth });
    }
  };

  const handleDepthChange = (newD: number) => {
    const clampedD = Math.max(0.1, Math.round(newD * 100) / 100);
    setDepth(clampedD);

    if (keepAspect && depth > 0) {
      const aspect = width / depth;
      const newW = Math.max(0.1, Math.round(clampedD * aspect * 100) / 100);
      setWidth(newW);
      handleUpdate({ width: newW, depth: clampedD });
    } else {
      handleUpdate({ width, depth: clampedD });
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

      {isObstacle ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            backgroundColor: '#1b1b1b',
            borderRadius: '4px',
            border: '1px solid #333',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3498db' }}>
              Размеры основания (X / Z)
            </span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: keepAspect ? '#2ecc71' : '#888',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="При включении изменение одного размера пропорционально меняет другой"
            >
              <input
                type="checkbox"
                checked={keepAspect}
                onChange={(e) => setKeepAspect(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#2ecc71' }}
              />
              <span>Сохранять пропорции</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <label
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '11px',
              }}
            >
              <span>Ширина X (м):</span>
              <input
                disabled={isReadOnly}
                type="number"
                value={width}
                min={0.1}
                max={100}
                step={0.1}
                onFocus={() => {
                  isFocusedRef.current = true;
                }}
                onBlur={() => {
                  isFocusedRef.current = false;
                }}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '4px 6px',
                  fontSize: '11px',
                }}
              />
            </label>

            <label
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '11px',
              }}
            >
              <span>Длина Z (м):</span>
              <input
                disabled={isReadOnly}
                type="number"
                value={depth}
                min={0.1}
                max={100}
                step={0.1}
                onFocus={() => {
                  isFocusedRef.current = true;
                }}
                onBlur={() => {
                  isFocusedRef.current = false;
                }}
                onChange={(e) => handleDepthChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '4px 6px',
                  fontSize: '11px',
                }}
              />
            </label>
          </div>
        </div>
      ) : (
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
      )}

      <label>
        Рост / Высота (м):
        <input
          disabled={isReadOnly}
          type="number"
          value={height}
          min={0.1}
          max={20}
          step={0.05}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChange={(e) => handleUpdate({ height: Math.max(0.1, Number(e.target.value)) })}
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
