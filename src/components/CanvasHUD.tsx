import React, { useState } from 'react';
import { Camera } from '../Camera';
import { Point } from '../types';
import { CAMERA_CONFIG } from '../../config/cameraConfig';

export interface CanvasHUDProps {
  camera: Camera | null | undefined;
  cursorWorldPos: Point | null;
  onResetCamera: () => void;
}

export const CanvasHUD: React.FC<CanvasHUDProps> = ({ camera, cursorWorldPos, onResetCamera }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [panSpeed, setPanSpeed] = useState(() => camera?.panSpeed ?? 1.0);
  const [rotateSpeed, setRotateSpeed] = useState(() => camera?.rotateSpeed ?? 1.0);

  const scalePercent = camera ? Math.round(camera.scale * 100) : 100;
  const cameraX = camera ? Math.round(-camera.offsetX / camera.scale) : 0;
  const cameraY = camera ? Math.round(-camera.offsetY / camera.scale) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        userSelect: 'none',
      }}
    >
      {/* Главная информационная плашка */}
      <div
        style={{
          backgroundColor: 'rgba(20, 20, 20, 0.78)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px',
          padding: '6px 10px',
          color: '#ccc',
          fontSize: '11px',
          fontFamily: 'monospace',
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

        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          title="Настройки чувствительности камеры"
          style={{
            backgroundColor: isSettingsOpen ? '#2980b9' : '#2c3e50',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            transition: 'background-color 0.15s',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Выпадающая панель настройки скоростей */}
      {isSettingsOpen && (
        <div
          style={{
            marginTop: '6px',
            backgroundColor: 'rgba(24, 24, 24, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#eee',
            fontSize: '11px',
            fontFamily: 'sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            width: '210px',
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '11px',
              color: '#3498db',
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
            }}
          >
            Чувствительность камеры
          </div>

          {/* Ползунок скорости панорамирования */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bbb' }}>
              <span>Сдвиг (СКМ):</span>
              <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>{panSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={panSpeed}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPanSpeed(val);
                camera?.setPanSpeed(val);
              }}
              style={{ cursor: 'pointer', accentColor: '#2ecc71' }}
            />
          </label>

          {/* Ползунок скорости поворота и наклона */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bbb' }}>
              <span>Поворот/Наклон (Alt):</span>
              <span style={{ color: '#f39c12', fontWeight: 'bold' }}>
                {rotateSpeed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={rotateSpeed}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setRotateSpeed(val);
                camera?.setRotateSpeed(val);
              }}
              style={{ cursor: 'pointer', accentColor: '#f39c12' }}
            />
          </label>

          <button
            onClick={() => {
              setPanSpeed(CAMERA_CONFIG.defaultPanSpeed);
              setRotateSpeed(CAMERA_CONFIG.defaultRotateSpeed);
              camera?.setPanSpeed(CAMERA_CONFIG.defaultPanSpeed);
              camera?.setRotateSpeed(CAMERA_CONFIG.defaultRotateSpeed);
            }}
            style={{
              backgroundColor: '#2c3e50',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '10px',
              alignSelf: 'flex-end',
            }}
          >
            Сброс ({CAMERA_CONFIG.defaultPanSpeed}x)
          </button>
        </div>
      )}
    </div>
  );
};
