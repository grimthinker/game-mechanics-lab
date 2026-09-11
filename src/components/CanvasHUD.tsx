import React from 'react';
import { Camera } from '../Camera';
import { Point } from '../types';

export interface CanvasHUDProps {
  camera: Camera | null | undefined;
  cursorWorldPos: Point | null;
  onResetCamera: () => void;
}

export const CanvasHUD: React.FC<CanvasHUDProps> = ({ camera, cursorWorldPos, onResetCamera }) => {
  const scalePercent = camera ? Math.round(camera.scale * 100) : 100;
  const cameraX = camera ? Math.round(-camera.offsetX / camera.scale) : 0;
  const cameraY = camera ? Math.round(-camera.offsetY / camera.scale) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(20, 20, 20, 0.78)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '6px',
        padding: '6px 10px',
        color: '#ccc',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 35,
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#888' }}>Зум:</span>
        <strong style={{ color: '#fff' }}>{scalePercent}%</strong>
        <button
          onClick={onResetCamera}
          title="Сбросить камеру к центру мира (Масштаб 100%)"
          style={{
            backgroundColor: '#2c3e50',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            cursor: 'pointer',
            padding: '2px 5px',
            fontSize: '10px',
            marginLeft: '2px',
          }}
        >
          ⌖ Сброс
        </button>
      </div>

      <div style={{ borderLeft: '1px solid #333', paddingLeft: '8px' }}>
        <span style={{ color: '#888' }}>Камера: </span>
        <span style={{ color: '#3498db' }}>
          X:{cameraX} Y:{cameraY}
        </span>
      </div>

      <div style={{ borderLeft: '1px solid #333', paddingLeft: '8px' }}>
        <span style={{ color: '#888' }}>Курсор: </span>
        {cursorWorldPos ? (
          <span style={{ color: '#2ecc71' }}>
            X:{cursorWorldPos.x} Y:{cursorWorldPos.y}
          </span>
        ) : (
          <span style={{ color: '#666' }}>—</span>
        )}
      </div>
    </div>
  );
};
