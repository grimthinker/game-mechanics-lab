import React, { useEffect, useState } from 'react';
import { GameApp } from '../../GameApp';
import { TerrainToolType, TerrainTextureChannel } from '../../types';
import { t } from '../../locales';

export const TerrainDock: React.FC<{ app?: GameApp | null }> = ({ app }) => {
  const [active, setActive] = useState(false);
  const [tool, setTool] = useState<TerrainToolType>('raise');
  const [texture, setTexture] = useState<TerrainTextureChannel>(0);
  const [radius, setRadius] = useState(() => {
    const saved = localStorage.getItem('terrain_brush_radius');
    return saved !== null ? Number(saved) : 3.0;
  });
  const [strength, setStrength] = useState(() => {
    const saved = localStorage.getItem('terrain_brush_strength');
    return saved !== null ? Number(saved) : 2.0;
  });

  useEffect(() => {
    localStorage.setItem('terrain_brush_radius', radius.toString());
  }, [radius]);

  useEffect(() => {
    localStorage.setItem('terrain_brush_strength', strength.toString());
  }, [strength]);

  // Синхронизация локального состояния React со стейтом кисти движка
  useEffect(() => {
    if (!app) return;

    app.terrainBrush = { active, tool, texture, radius, strength };

    // Если активирован режим кисти — сбрасываем выделение объектов, чтобы клик рисовал, а не выделял
    if (active) {
      app.selection.clear();
      app.gizmo.cancelDrag();
    }
  }, [app, active, tool, texture, radius, strength]);

  // Выключение режима при закрытии вкладки или размонтировании
  useEffect(() => {
    return () => {
      if (app) app.terrainBrush.active = false;
    };
  }, [app]);

  const tools: { id: TerrainToolType; icon: string; label: string }[] = [
    { id: 'raise', icon: '📈', label: t('terrain.tool_raise') },
    { id: 'lower', icon: '📉', label: t('terrain.tool_lower') },
    { id: 'flatten', icon: '📏', label: t('terrain.tool_flatten') },
    { id: 'smooth', icon: '🌊', label: t('terrain.tool_smooth') },
    { id: 'paint', icon: '🎨', label: t('terrain.tool_paint') },
  ];

  const textures: { id: TerrainTextureChannel; color: string; label: string }[] = [
    { id: 0, color: '#2ecc71', label: t('terrain.tex_grass') },
    { id: 1, color: '#95a5a6', label: t('terrain.tex_rock') },
    { id: 2, color: '#8d6e63', label: t('terrain.tex_dirt') },
    { id: 3, color: '#f4a460', label: t('terrain.tex_sand') },
  ];

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: '#ecf0f1',
        userSelect: 'none',
      }}
    >
      {/* Главный тумблер включения режима кисти */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: active ? '#1b4332' : '#1e1e1e',
          border: active ? '1px solid #2ecc71' : '1px solid #333',
          padding: '12px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
        />
        {t('terrain.enable')}
      </label>

      {/* Выбор инструмента */}
      <div
        style={{
          opacity: active ? 1 : 0.5,
          pointerEvents: active ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#bdc3c7',
            marginBottom: '8px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {t('terrain.tools')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              style={{
                flex: '1 1 calc(50% - 6px)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: tool === t.id ? '#2980b9' : '#222',
                color: '#fff',
                border: tool === t.id ? '1px solid #3498db' : '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: tool === t.id ? 'bold' : 'normal',
              }}
            >
              <span style={{ fontSize: '16px' }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Выбор текстуры (только если выбран инструмент "Покраска") */}
      {tool === 'paint' && (
        <div style={{ opacity: active ? 1 : 0.5, pointerEvents: active ? 'auto' : 'none' }}>
          <div
            style={{
              fontSize: '11px',
              color: '#bdc3c7',
              marginBottom: '8px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            {t('terrain.textures')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {textures.map((tex) => (
              <button
                key={tex.id}
                onClick={() => setTexture(tex.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  backgroundColor: texture === tex.id ? '#222' : '#1a1a1a',
                  color: '#fff',
                  border: texture === tex.id ? `2px solid ${tex.color}` : '1px solid #333',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: tex.color,
                    borderRadius: '2px',
                  }}
                />
                <span>{tex.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ползунки Радиуса и Интенсивности */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          opacity: active ? 1 : 0.5,
          pointerEvents: active ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12px',
            color: '#bdc3c7',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('terrain.radius')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                min="0.2"
                max="30.0"
                step="0.1"
                value={Number(radius.toFixed(1))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setRadius(isNaN(val) ? 0.2 : val);
                }}
                onBlur={() => setRadius((prev) => Math.max(0.2, Math.min(30.0, prev)))}
                style={{
                  width: '56px',
                  backgroundColor: '#111',
                  border: '1px solid #444',
                  borderRadius: '3px',
                  color: '#2ecc71',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  padding: '2px 4px',
                  textAlign: 'right',
                }}
              />
              <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>м</span>
            </div>
          </div>
          <input
            type="range"
            min="0.2"
            max="30.0"
            step="0.1"
            value={Math.max(0.2, Math.min(30.0, radius))}
            onChange={(e) => setRadius(Number(e.target.value))}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              accentColor: '#2ecc71',
              cursor: 'pointer',
              margin: 0,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12px',
            color: '#bdc3c7',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('terrain.strength')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                min="0.1"
                max="25.0"
                step="0.1"
                value={Number(strength.toFixed(2))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setStrength(isNaN(val) ? 0.1 : val);
                }}
                onBlur={() => setStrength((prev) => Math.max(0.1, Math.min(25.0, prev)))}
                style={{
                  width: '56px',
                  backgroundColor: '#111',
                  border: '1px solid #444',
                  borderRadius: '3px',
                  color: '#3498db',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  padding: '2px 4px',
                  textAlign: 'right',
                }}
              />
              <span style={{ color: '#3498db', fontWeight: 'bold' }}>x</span>
            </div>
          </div>
          <input
            type="range"
            min="0.1"
            max="25.0"
            step="0.1"
            value={Math.max(0.1, Math.min(25.0, strength))}
            onChange={(e) => setStrength(Number(e.target.value))}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              accentColor: '#3498db',
              cursor: 'pointer',
              margin: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
};
