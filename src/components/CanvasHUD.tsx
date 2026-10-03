import React, { useState } from 'react';
import { Camera } from '../Camera';
import { Vec3, GizmoTool } from '../types';
import { t } from '../locales';
import { CAMERA_CONFIG } from '../config/cameraConfig';
import { HUD_CONFIG } from '../config/hudConfig';

export interface CanvasHUDProps {
  camera: Camera | null | undefined;
  cursorWorldPos: Vec3 | null;
  onResetCamera: () => void;
  gizmoTool?: GizmoTool;
  onSelectGizmoTool?: (tool: GizmoTool) => void;
}

export const CanvasHUD: React.FC<CanvasHUDProps> = ({
  camera,
  cursorWorldPos,
  onResetCamera,
  gizmoTool = 'translate',
  onSelectGizmoTool,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [panSpeed, setPanSpeed] = useState(() => camera?.panSpeed ?? 1.0);
  const [rotateSpeed, setRotateSpeed] = useState(() => camera?.rotateSpeed ?? 1.0);

  const scalePercent = camera ? Math.round(camera.scale * 100) : 100;
  const cameraX = camera ? camera.targetX.toFixed(1) : '0.0';
  const cameraY = camera ? camera.targetY.toFixed(1) : '0.0';
  const cameraZ = camera ? camera.targetZ.toFixed(1) : '0.0';

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
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
          backgroundColor: HUD_CONFIG.canvasHud.barBg,
          backdropFilter: 'blur(6px)',
          border: `1px solid ${HUD_CONFIG.canvasHud.barBorder}`,
          borderRadius: '6px',
          padding: '6px 10px',
          color: HUD_CONFIG.canvasHud.textNormal,
          fontSize: '11px',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: HUD_CONFIG.canvasHud.textLabel }}>{t('hud.zoom')}</span>
          <strong style={{ color: HUD_CONFIG.canvasHud.textValue }}>{scalePercent}%</strong>
          <button
            onClick={onResetCamera}
            title={t('hud.resetTitle')}
            style={{
              backgroundColor: HUD_CONFIG.canvasHud.btnBg,
              border: 'none',
              borderRadius: '3px',
              color: HUD_CONFIG.canvasHud.textValue,
              cursor: 'pointer',
              padding: '2px 5px',
              fontSize: '10px',
              marginLeft: '2px',
            }}
          >
            {t('hud.reset')}
          </button>
        </div>

        <div style={{ borderLeft: '1px solid #333', paddingLeft: '8px' }}>
          <span style={{ color: HUD_CONFIG.canvasHud.textLabel }}>{t('hud.camera')} </span>
          <span style={{ color: HUD_CONFIG.canvasHud.textCamera }}>
            X:{cameraX}m Y:{cameraY}m Z:{cameraZ}m
          </span>
        </div>

        <div style={{ borderLeft: '1px solid #333', paddingLeft: '8px' }}>
          <span style={{ color: HUD_CONFIG.canvasHud.textLabel }}>{t('hud.cursor')} </span>
          {cursorWorldPos ? (
            <span style={{ color: HUD_CONFIG.canvasHud.textCursor }}>
              X:{cursorWorldPos.x.toFixed(1)}m Y:{cursorWorldPos.y.toFixed(1)}m Z:
              {cursorWorldPos.z.toFixed(1)}m
            </span>
          ) : (
            <span style={{ color: HUD_CONFIG.canvasHud.textNone }}>—</span>
          )}
        </div>

        {/* Тулбар манипуляторов трансформации */}
        {onSelectGizmoTool && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderLeft: '1px solid #333',
              paddingLeft: '8px',
            }}
          >
            <span style={{ color: HUD_CONFIG.canvasHud.textLabel }}>{t('hud.gizmo')}</span>
            <button
              onClick={() => onSelectGizmoTool('select')}
              title={t('hud.gizmoSelect')}
              style={{
                backgroundColor:
                  gizmoTool === 'select'
                    ? HUD_CONFIG.canvasHud.btnActiveBg
                    : HUD_CONFIG.canvasHud.btnBg,
                border: 'none',
                borderRadius: '3px',
                color: HUD_CONFIG.canvasHud.textValue,
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: gizmoTool === 'select' ? 'bold' : 'normal',
              }}
            >
              ⛶ Q
            </button>
            <button
              onClick={() => onSelectGizmoTool('translate')}
              title={t('hud.gizmoTranslate')}
              style={{
                backgroundColor:
                  gizmoTool === 'translate'
                    ? HUD_CONFIG.canvasHud.btnActiveBg
                    : HUD_CONFIG.canvasHud.btnBg,
                border: 'none',
                borderRadius: '3px',
                color: HUD_CONFIG.canvasHud.textValue,
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: gizmoTool === 'translate' ? 'bold' : 'normal',
              }}
            >
              ✥ W
            </button>
            <button
              onClick={() => onSelectGizmoTool('rotate')}
              title={t('hud.gizmoRotate')}
              style={{
                backgroundColor:
                  gizmoTool === 'rotate'
                    ? HUD_CONFIG.canvasHud.btnActiveBg
                    : HUD_CONFIG.canvasHud.btnBg,
                border: 'none',
                borderRadius: '3px',
                color: HUD_CONFIG.canvasHud.textValue,
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: gizmoTool === 'rotate' ? 'bold' : 'normal',
              }}
            >
              ↻ E
            </button>
          </div>
        )}

        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          title={t('hud.sensitivityBtnTitle')}
          style={{
            backgroundColor: isSettingsOpen
              ? HUD_CONFIG.canvasHud.btnActiveBg
              : HUD_CONFIG.canvasHud.btnBg,
            border: 'none',
            borderRadius: '3px',
            color: HUD_CONFIG.canvasHud.textValue,
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
            backgroundColor: HUD_CONFIG.canvasHud.settingsPanelBg,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${HUD_CONFIG.canvasHud.settingsPanelBorder}`,
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
              color: HUD_CONFIG.canvasHud.settingsHeader,
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
            }}
          >
            {t('hud.sensitivityTitle')}
          </div>

          {/* Ползунок скорости панорамирования */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bbb' }}>
              <span>{t('hud.panSpeed')}</span>
              <span style={{ color: HUD_CONFIG.canvasHud.panAccent, fontWeight: 'bold' }}>
                {panSpeed.toFixed(1)}x
              </span>
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
              style={{ cursor: 'pointer', accentColor: HUD_CONFIG.canvasHud.panAccent }}
            />
          </label>

          {/* Ползунок скорости поворота и наклона */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bbb' }}>
              <span>{t('hud.rotateSpeed')}</span>
              <span style={{ color: HUD_CONFIG.canvasHud.rotateAccent, fontWeight: 'bold' }}>
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
              style={{ cursor: 'pointer', accentColor: HUD_CONFIG.canvasHud.rotateAccent }}
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
            {t('common.reset')} ({CAMERA_CONFIG.defaultPanSpeed}x)
          </button>
        </div>
      )}
    </div>
  );
};
