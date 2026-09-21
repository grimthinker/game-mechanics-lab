import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { rad2Deg, deg2Rad } from '../../utils';
import { t } from '../../locales';

export interface SensesInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const SensesInspector: React.FC<SensesInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const vision = world.getComponent(targetId, 'vision');
  const hearing = world.getComponent(targetId, 'hearing');

  const [fovAngle, setFovAngle] = useState(
    vision ? Math.round(rad2Deg(vision.fovAngle.base)) : 135
  );
  const [clarity, setClarity] = useState(vision ? vision.clarity.base : 1.0);
  const [visionMaxDistance, setVisionMaxDistance] = useState(vision ? vision.maxDistance.base : 25);

  const [sensitivity, setSensitivity] = useState(hearing ? hearing.sensitivity.base : 1.0);
  const [hearingMaxDistance, setHearingMaxDistance] = useState(
    hearing ? hearing.maxDistance.base : 30
  );

  useEffect(() => {
    const v = world.getComponent(targetId, 'vision');
    if (v) {
      setFovAngle(Math.round(rad2Deg(v.fovAngle.base)));
      setClarity(v.clarity.base);
      setVisionMaxDistance(v.maxDistance.base);
    }
    const h = world.getComponent(targetId, 'hearing');
    if (h) {
      setSensitivity(h.sensitivity.base);
      setHearingMaxDistance(h.maxDistance.base);
    }
  }, [targetId, world]);

  if (!vision && !hearing) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {vision && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3498db' }}>
            {t('inspector.vision')}
          </span>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {t('inspector.fovAngle')}
            <input
              disabled={isReadOnly}
              type="number"
              value={fovAngle}
              min={10}
              max={360}
              step={5}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFovAngle(val);
                if (app) {
                  app.updateEntityVision(targetId, { fovAngle: deg2Rad(val) });
                  onCommit(t('history.visionChange'));
                }
              }}
            />
          </label>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {t('inspector.clarity')}
            <input
              disabled={isReadOnly}
              type="number"
              value={clarity}
              min={0.1}
              max={5}
              step={0.1}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                setClarity(val);
                if (app) {
                  app.updateEntityVision(targetId, { clarity: val });
                  onCommit(t('history.visionChange'));
                }
              }}
            />
          </label>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {t('inspector.maxDistance')}
            <input
              disabled={isReadOnly}
              type="number"
              value={visionMaxDistance}
              min={1}
              max={150}
              step={1}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVisionMaxDistance(val);
                if (app) {
                  app.updateEntityVision(targetId, { maxDistance: val });
                  onCommit(t('history.visionChange'));
                }
              }}
            />
          </label>
        </div>
      )}

      {hearing && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingTop: vision ? '8px' : 0,
            borderTop: vision ? '1px solid #333' : 'none',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2ecc71' }}>
            {t('inspector.hearing')}
          </span>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {t('inspector.sensitivity')}
            <input
              disabled={isReadOnly}
              type="number"
              value={sensitivity}
              min={0.1}
              max={5}
              step={0.1}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSensitivity(val);
                if (app) {
                  app.updateEntityHearing(targetId, { sensitivity: val });
                  onCommit(t('history.hearingChange'));
                }
              }}
            />
          </label>
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {t('inspector.maxDistance')}
            <input
              disabled={isReadOnly}
              type="number"
              value={hearingMaxDistance}
              min={1}
              max={150}
              step={1}
              style={{ width: '70px', padding: '2px 4px', textAlign: 'right' }}
              onChange={(e) => {
                const val = Number(e.target.value);
                setHearingMaxDistance(val);
                if (app) {
                  app.updateEntityHearing(targetId, { maxDistance: val });
                  onCommit(t('history.hearingChange'));
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
};
