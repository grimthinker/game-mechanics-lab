import React, { useState } from 'react';
import { GameMode, THEME_COLORS } from '../constants';

export interface TopBarProps {
  mode: GameMode;
  goToEditor: () => void;
  goToSimulation: () => void;
  goToGame: () => void;
  obstaclesEnabled: boolean;
  setObstaclesEnabled: (val: boolean) => void;
  worldFileInputRef: React.RefObject<HTMLInputElement | null>;
  onNewWorld: () => void;
  onSaveWorld: () => void;
  onLoadWorldFile: (file: File) => void;
  isPaused: boolean;
  togglePause: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenHotkeys: () => void;
  renderMode: '2d' | '3d';
  onToggleRenderMode: () => void;
  showUIOverlays: boolean;
  setShowUIOverlays: (val: boolean) => void;
  showAIDebug: boolean;
  setShowAIDebug: (val: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  goToEditor,
  goToSimulation,
  goToGame,
  obstaclesEnabled,
  setObstaclesEnabled,
  worldFileInputRef,
  onNewWorld,
  onSaveWorld,
  onLoadWorldFile,
  isPaused,
  togglePause,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHotkeys,
  renderMode,
  onToggleRenderMode,
  showUIOverlays,
  setShowUIOverlays,
  showAIDebug,
  setShowAIDebug,
}) => {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  return (
    <div
      style={{
        height: '48px',
        backgroundColor: '#111',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: '#ecf0f1',
        boxSizing: 'border-box',
        zIndex: 200,
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      }}
    >
      {/* Левая часть: Файл и История */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-sm"
            style={{ backgroundColor: '#2c3e50', color: '#fff', border: 'none' }}
            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
          >
            Файл ▼
          </button>
          {isFileMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                onClick={() => setIsFileMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: '#222',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '4px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '150px',
                  zIndex: 200,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onNewWorld();
                    setIsFileMenuOpen(false);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Новый мир
                </button>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSaveWorld();
                    setIsFileMenuOpen(false);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Сохранить (JSON)
                </button>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    worldFileInputRef.current?.click();
                    setIsFileMenuOpen(false);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Загрузить (JSON)
                </button>
                <input
                  type="file"
                  ref={worldFileInputRef}
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onLoadWorldFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div
          style={{ display: 'flex', gap: '4px', borderLeft: '1px solid #444', paddingLeft: '12px' }}
        >
          <button
            className="btn btn-sm"
            style={{
              opacity: canUndo ? 1 : 0.5,
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #444',
            }}
            disabled={!canUndo}
            onClick={onUndo}
            title="Отменить действие (Ctrl+Z)"
          >
            ↶ Отмена
          </button>
          <button
            className="btn btn-sm"
            style={{
              opacity: canRedo ? 1 : 0.5,
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #444',
            }}
            disabled={!canRedo}
            onClick={onRedo}
            title="Повторить действие (Ctrl+Y)"
          >
            ↷ Повтор
          </button>
        </div>
      </div>

      {/* Центральная часть: Режимы и Пауза */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#1a1a1a',
          padding: '4px',
          borderRadius: '6px',
          border: '1px solid #333',
        }}
      >
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: mode === GameMode.EDITOR ? '#2980b9' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '4px 12px',
          }}
          onClick={goToEditor}
        >
          Редактор
        </button>
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: mode === GameMode.SIMULATION ? '#27ae60' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '4px 12px',
          }}
          onClick={goToSimulation}
        >
          Симуляция
        </button>
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: mode === GameMode.GAME ? '#8e44ad' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '4px 12px',
          }}
          onClick={goToGame}
        >
          Играть
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#444', margin: '0 4px' }} />

        <button
          className="btn btn-sm"
          style={{
            backgroundColor: isPaused ? '#e74c3c' : 'transparent',
            color: isPaused ? '#fff' : '#e74c3c',
            border: '1px solid #e74c3c',
            padding: '4px 12px',
          }}
          onClick={togglePause}
          disabled={mode === GameMode.GAME}
          title="Пауза/Возобновление (Пробел)"
        >
          {isPaused ? 'ПАУЗА' : '▶ ИДЕТ'}
        </button>
      </div>

      {/* Правая часть: Настройки отображения */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: renderMode === '3d' ? '#9b59b6' : 'transparent',
            color: renderMode === '3d' ? '#fff' : '#bdc3c7',
            border: '1px solid #9b59b6',
            padding: '2px 8px',
            fontSize: '11px',
          }}
          onClick={onToggleRenderMode}
          title="Переключить рендерер"
        >
          {renderMode === '2d' ? '2D CANVAS' : '3D WEBGL'}
        </button>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#bdc3c7',
          }}
        >
          <input
            type="checkbox"
            checked={showUIOverlays}
            onChange={(e) => setShowUIOverlays(e.target.checked)}
          />
          Имена и HP
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#bdc3c7',
          }}
        >
          <input
            type="checkbox"
            checked={obstaclesEnabled}
            onChange={(e) => setObstaclesEnabled(e.target.checked)}
          />
          Коллизии
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#f39c12',
            marginLeft: '8px',
          }}
        >
          <input
            type="checkbox"
            checked={showAIDebug}
            onChange={(e) => setShowAIDebug(e.target.checked)}
            style={{ accentColor: '#f39c12' }}
          />
          AI Debug
        </label>

        <button
          className="btn btn-sm"
          style={{
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            padding: 0,
          }}
          onClick={onOpenHotkeys}
          title="Горячие клавиши"
        >
          ?
        </button>
      </div>
    </div>
  );
};
