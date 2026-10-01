import React, { useState, useEffect, useRef } from 'react';
import { GameApp } from '../../GameApp';
import { PropBrushPreset, PropBrushItem, BrushShape } from '../../types';
import { getPropRegistry } from '../../editor/PropRegistry';
import { useResizable } from '../../hooks/useResizable';
import { t } from '../../locales';

export const PropBrushDock: React.FC<{ app?: GameApp | null }> = ({ app }) => {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'paint' | 'erase'>('paint');
  const [shape, setShape] = useState<BrushShape>(() => {
    const saved = localStorage.getItem('prop_brush_shape');
    return saved === 'square' ? 'square' : 'circle';
  });
  const [rotation, setRotation] = useState<number>(() => {
    const saved = localStorage.getItem('prop_brush_rotation');
    return saved !== null ? Number(saved) : 0;
  });
  const [radius, setRadius] = useState(5.0);
  const [density, setDensity] = useState(0.5);
  const [minDistance, setMinDistance] = useState(2.0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Настраиваемая высота списка моделей в наборе
  const {
    size: listHeight,
    isResizing: isResizingList,
    startResizing: startResizingList,
  } = useResizable({
    storageKey: 'prop_brush_list_height',
    initialSize: 280,
    minSize: 120,
    maxSize: () => Math.max(160, window.innerHeight - 350),
    direction: 'vertical',
  });

  const [presets, setPresets] = useState<PropBrushPreset[]>(() => {
    const saved = localStorage.getItem('prop_brush_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'default_forest',
        name: 'Лес (Стандарт)',
        items: [
          {
            propId: 'tree_1',
            weight: 1.0,
            scaleMin: { x: 0.8, y: 0.8, z: 0.8 },
            scaleMax: { x: 1.2, y: 1.2, z: 1.2 },
            rotMin: { x: 0, y: 0, z: 0 },
            rotMax: { x: 0, y: 360, z: 0 },
          },
          {
            propId: 'tree_2',
            weight: 0.5,
            scaleMin: { x: 0.9, y: 0.9, z: 0.9 },
            scaleMax: { x: 1.3, y: 1.3, z: 1.3 },
            rotMin: { x: 0, y: 0, z: 0 },
            rotMax: { x: 0, y: 360, z: 0 },
          },
          {
            propId: 'rock_1',
            weight: 0.2,
            scaleMin: { x: 0.5, y: 0.5, z: 0.5 },
            scaleMax: { x: 1.5, y: 1.0, z: 1.5 },
            rotMin: { x: 0, y: 0, z: 0 },
            rotMax: { x: 0, y: 360, z: 0 },
          },
        ],
      },
    ];
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(presets[0]?.id || null);

  useEffect(() => {
    localStorage.setItem('prop_brush_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('prop_brush_shape', shape);
  }, [shape]);

  useEffect(() => {
    localStorage.setItem('prop_brush_rotation', rotation.toString());
  }, [rotation]);

  useEffect(() => {
    if (!app) return;
    app.propBrushPresets = presets;
    app.propBrush = { active, mode, shape, rotation, radius, density, minDistance, activePresetId };

    if (active) {
      app.terrainBrush.active = false;
      app.selection.clear();
      app.gizmo.cancelDrag();
    }
  }, [app, active, mode, shape, rotation, radius, density, minDistance, activePresetId, presets]);

  useEffect(() => {
    return () => {
      if (app) app.propBrush.active = false;
    };
  }, [app]);

  const activePreset = presets.find((p) => p.id === activePresetId);
  const registry = getPropRegistry();

  const handleAddPreset = () => {
    const newPreset: PropBrushPreset = {
      id: `preset_${Date.now()}`,
      name: `Новый набор ${presets.length + 1}`,
      items: [],
    };
    setPresets([...presets, newPreset]);
    setActivePresetId(newPreset.id);
  };

  const handleDeletePreset = (id: string) => {
    const filtered = presets.filter((p) => p.id !== id);
    setPresets(filtered);
    if (activePresetId === id) setActivePresetId(filtered[0]?.id || null);
  };

  const handleExportPreset = () => {
    if (!activePreset) return;
    const dataStr = JSON.stringify(activePreset, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prop_preset_${activePreset.name.toLowerCase().replace(/[^a-zа-я0-9_-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed || !Array.isArray(parsed.items)) {
          alert('Неверный формат JSON файла набора!');
          return;
        }

        const newPreset: PropBrushPreset = {
          id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: parsed.name ? `${parsed.name} (Импорт)` : 'Импортированный набор',
          items: parsed.items.map((it: any) => ({
            propId: it.propId || 'tree_1',
            weight: typeof it.weight === 'number' ? it.weight : 1.0,
            scaleMin: it.scaleMin ? { ...it.scaleMin } : { x: 1, y: 1, z: 1 },
            scaleMax: it.scaleMax ? { ...it.scaleMax } : { x: 1, y: 1, z: 1 },
            rotMin: it.rotMin ? { ...it.rotMin } : { x: 0, y: 0, z: 0 },
            rotMax: it.rotMax ? { ...it.rotMax } : { x: 0, y: 360, z: 0 },
            offsetY: typeof it.offsetY === 'number' ? it.offsetY : 0,
          })),
        };

        setPresets((prev) => [...prev, newPreset]);
        setActivePresetId(newPreset.id);
      } catch (err) {
        console.error('[PropBrush] Ошибка чтения JSON набора:', err);
        alert('Ошибка при чтении JSON файла набора!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddItemToPreset = () => {
    if (!activePresetId) return;
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== activePresetId) return p;
        return {
          ...p,
          items: [
            ...p.items,
            {
              propId: registry[0].id,
              weight: 1.0,
              scaleMin: { x: 1, y: 1, z: 1 },
              scaleMax: { x: 1, y: 1, z: 1 },
              rotMin: { x: 0, y: 0, z: 0 },
              rotMax: { x: 0, y: 360, z: 0 },
              offsetY: 0,
            },
          ],
        };
      })
    );
  };

  const updateItem = (index: number, patch: Partial<PropBrushItem>) => {
    if (!activePresetId) return;
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== activePresetId) return p;
        const newItems = [...p.items];
        newItems[index] = { ...newItems[index], ...patch };
        return { ...p, items: newItems };
      })
    );
  };

  const deleteItem = (index: number) => {
    if (!activePresetId) return;
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== activePresetId) return p;
        const newItems = [...p.items];
        newItems.splice(index, 1);
        return { ...p, items: newItems };
      })
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: '#ecf0f1',
        overflowY: 'auto',
      }}
    >
      {/* Главный тумблер */}
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
        }}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          style={{ transform: 'scale(1.2)' }}
        />
        Кисть объектов (Prop Brush)
      </label>

      {/* Инструменты */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setMode('paint')}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: mode === 'paint' ? '#2980b9' : '#222',
            color: '#fff',
            border: mode === 'paint' ? '1px solid #3498db' : '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🌲 Посадка
        </button>
        <button
          onClick={() => setMode('erase')}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: mode === 'erase' ? '#c0392b' : '#222',
            color: '#fff',
            border: mode === 'erase' ? '1px solid #e74c3c' : '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🧹 Ластик
        </button>
      </div>

      {/* Форма кисти: Круг / Квадрат */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            fontSize: '11px',
            color: '#bdc3c7',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          Форма кисти
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShape('circle')}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: shape === 'circle' ? '#2980b9' : '#222',
              color: '#fff',
              border: shape === 'circle' ? '1px solid #3498db' : '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: shape === 'circle' ? 'bold' : 'normal',
            }}
          >
            ⚪ Круг
          </button>
          <button
            type="button"
            onClick={() => setShape('square')}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: shape === 'square' ? '#2980b9' : '#222',
              color: '#fff',
              border: shape === 'square' ? '1px solid #3498db' : '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: shape === 'square' ? 'bold' : 'normal',
            }}
          >
            ⬛ Квадрат
          </button>
        </div>

        {/* Угол поворота квадрата */}
        {shape === 'square' && (
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
              <span>Угол поворота:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={Math.round(rotation)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRotation(isNaN(val) ? 0 : val);
                  }}
                  onBlur={() => setRotation((prev) => Math.max(0, Math.min(90, prev)))}
                  style={{
                    width: '56px',
                    backgroundColor: '#111',
                    border: '1px solid #444',
                    borderRadius: '3px',
                    color: '#9b59b6',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    padding: '2px 4px',
                    textAlign: 'right',
                  }}
                />
                <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>°</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                accentColor: '#9b59b6',
                cursor: 'pointer',
                margin: 0,
              }}
            />
          </div>
        )}
      </div>

      {/* Параметры кисти в точном стиле TerrainDock */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Радиус кисти */}
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
            <span>Радиус кисти:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                min="0.5"
                max="50.0"
                step="0.5"
                value={Number(radius.toFixed(1))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setRadius(isNaN(val) ? 0.5 : val);
                }}
                onBlur={() => setRadius((prev) => Math.max(0.5, Math.min(50.0, prev)))}
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
            min="0.5"
            max="50.0"
            step="0.5"
            value={Math.max(0.5, Math.min(50.0, radius))}
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

        {mode === 'paint' && (
          <>
            {/* Интенсивность */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
                color: '#bdc3c7',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>Интенсивность:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    step="5"
                    value={Math.round(density * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setDensity(isNaN(val) ? 0.05 : val / 100);
                    }}
                    onBlur={() => setDensity((prev) => Math.max(0.05, Math.min(1.0, prev)))}
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
                  <span style={{ color: '#3498db', fontWeight: 'bold' }}>%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={Math.max(0.05, Math.min(1.0, density))}
                onChange={(e) => setDensity(Number(e.target.value))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  accentColor: '#3498db',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
            </div>

            {/* Мин. дистанция */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
                color: '#bdc3c7',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>Мин. дистанция:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="0.0"
                    max="20.0"
                    step="0.5"
                    value={Number(minDistance.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMinDistance(isNaN(val) ? 0.0 : val);
                    }}
                    onBlur={() => setMinDistance((prev) => Math.max(0.0, Math.min(20.0, prev)))}
                    style={{
                      width: '56px',
                      backgroundColor: '#111',
                      border: '1px solid #444',
                      borderRadius: '3px',
                      color: '#e67e22',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      padding: '2px 4px',
                      textAlign: 'right',
                    }}
                  />
                  <span style={{ color: '#e67e22', fontWeight: 'bold' }}>м</span>
                </div>
              </div>
              <input
                type="range"
                min="0.0"
                max="20.0"
                step="0.5"
                value={Math.max(0.0, Math.min(20.0, minDistance))}
                onChange={(e) => setMinDistance(Number(e.target.value))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  accentColor: '#e67e22',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Выбор набора с кнопками импорта/экспорта */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#bdc3c7', fontWeight: 'bold' }}>
            НАБОРЫ (ПРЕСЕТЫ)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportPreset}
              title="Сохранить текущий набор на компьютер (.json)"
              style={{
                background: 'none',
                border: 'none',
                color: '#3498db',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
              }}
            >
              💾
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Загрузить набор с компьютера (.json)"
              style={{
                background: 'none',
                border: 'none',
                color: '#f39c12',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
              }}
            >
              📂
            </button>
            <button
              type="button"
              onClick={handleAddPreset}
              title="Создать новый пустой набор"
              style={{
                background: 'none',
                border: 'none',
                color: '#2ecc71',
                cursor: 'pointer',
                fontSize: '16px',
                padding: 0,
              }}
            >
              +
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json"
          onChange={handleImportPreset}
        />

        <select
          value={activePresetId || ''}
          onChange={(e) => setActivePresetId(e.target.value)}
          style={{
            padding: '6px',
            backgroundColor: '#111',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Настройка элементов активного набора */}
      {activePreset && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              value={activePreset.name}
              onChange={(e) => {
                setPresets((prev) =>
                  prev.map((p) => (p.id === activePreset.id ? { ...p, name: e.target.value } : p))
                );
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #555',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '2px 0',
              }}
            />
            <button
              onClick={() => handleDeletePreset(activePreset.id)}
              style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
            >
              🗑️
            </button>
          </div>

          <button
            onClick={handleAddItemToPreset}
            style={{
              backgroundColor: '#222',
              border: '1px dashed #555',
              color: '#aaa',
              padding: '7px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + Добавить модель
          </button>

          {/* Изолированный прокручивающийся список моделей с настраиваемой высотой */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              height: `${listHeight}px`,
              minHeight: '120px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {activePreset.items.map((item, idx) => {
              const regItem = registry.find((r) => r.id === item.propId);
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#1b1b1b',
                    border: '1px solid #333',
                    padding: '10px',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Выбор модели и удаление */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <select
                      value={item.propId}
                      onChange={(e) => updateItem(idx, { propId: e.target.value })}
                      style={{
                        flex: 1,
                        backgroundColor: '#111',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: '3px',
                        padding: '4px 6px',
                        fontSize: '11px',
                      }}
                    >
                      {registry.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.icon} {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteItem(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#e74c3c',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontSize: '14px',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Шанс спавна с расширенным ползунком на 60% ширины */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#bdc3c7' }}>
                      Шанс:{' '}
                      <strong style={{ color: '#3498db' }}>{Math.round(item.weight * 100)}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0.05"
                      max="2.0"
                      step="0.05"
                      value={item.weight}
                      onChange={(e) => updateItem(idx, { weight: Number(e.target.value) })}
                      style={{ width: '60%', accentColor: '#3498db', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Смещение Y (Заглубление модели в землю) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #282828',
                      paddingTop: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#bdc3c7' }}>Смещение Y (м):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={item.offsetY ?? 0}
                      onChange={(e) => updateItem(idx, { offsetY: Number(e.target.value) })}
                      style={{
                        width: '70px',
                        padding: '4px 6px',
                        fontSize: '11px',
                        backgroundColor: '#111',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: '3px',
                        textAlign: 'center',
                      }}
                      title="Отрицательное значение заглубляет объект в землю"
                    />
                  </div>

                  {/* Масштаб (Множитель) с подписями над полями ввода */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTop: '1px solid #282828',
                      paddingTop: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#888' }}>Масштаб (Множитель):</span>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '10px', color: '#bdc3c7', textAlign: 'center' }}>
                          min X/Z
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.scaleMin.x}
                          onChange={(e) =>
                            updateItem(idx, {
                              scaleMin: {
                                ...item.scaleMin,
                                x: Number(e.target.value),
                                z: Number(e.target.value),
                              },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 6px',
                            fontSize: '11px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '10px', color: '#bdc3c7', textAlign: 'center' }}>
                          max X/Z
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.scaleMax.x}
                          onChange={(e) =>
                            updateItem(idx, {
                              scaleMax: {
                                ...item.scaleMax,
                                x: Number(e.target.value),
                                z: Number(e.target.value),
                              },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 6px',
                            fontSize: '11px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '10px', color: '#bdc3c7', textAlign: 'center' }}>
                          min Y
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.scaleMin.y}
                          onChange={(e) =>
                            updateItem(idx, {
                              scaleMin: { ...item.scaleMin, y: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 6px',
                            fontSize: '11px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '10px', color: '#bdc3c7', textAlign: 'center' }}>
                          max Y
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.scaleMax.y}
                          onChange={(e) =>
                            updateItem(idx, {
                              scaleMax: { ...item.scaleMax, y: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 6px',
                            fontSize: '11px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Настройка всех трех углов поворота в один ряд из 6 колонок */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTop: '1px solid #282828',
                      paddingTop: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#888' }}>Поворот (°):</span>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="min Yaw (Y)"
                        >
                          min Yaw
                        </span>
                        <input
                          type="number"
                          step="15"
                          value={item.rotMin.y}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMin: { ...item.rotMin, y: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="max Yaw (Y)"
                        >
                          max Yaw
                        </span>
                        <input
                          type="number"
                          step="15"
                          value={item.rotMax.y}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMax: { ...item.rotMax, y: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="min Pitch (X)"
                        >
                          min Pitch
                        </span>
                        <input
                          type="number"
                          step="5"
                          value={item.rotMin.x}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMin: { ...item.rotMin, x: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="max Pitch (X)"
                        >
                          max Pitch
                        </span>
                        <input
                          type="number"
                          step="5"
                          value={item.rotMax.x}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMax: { ...item.rotMax, x: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="min Roll (Z)"
                        >
                          min Roll
                        </span>
                        <input
                          type="number"
                          step="5"
                          value={item.rotMin.z}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMin: { ...item.rotMin, z: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#bdc3c7',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          title="max Roll (Z)"
                        >
                          max Roll
                        </span>
                        <input
                          type="number"
                          step="5"
                          value={item.rotMax.z}
                          onChange={(e) =>
                            updateItem(idx, {
                              rotMax: { ...item.rotMax, z: Number(e.target.value) },
                            })
                          }
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '4px 2px',
                            fontSize: '10px',
                            backgroundColor: '#111',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            textAlign: 'center',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Интерактивная ручка изменения высоты окна списка моделей */}
          <div
            onMouseDown={startResizingList}
            style={{
              height: '5px',
              backgroundColor: isResizingList ? '#2196f3' : '#2a2a2a',
              cursor: 'row-resize',
              borderTop: '1px solid #3a3a3a',
              borderBottom: '1px solid #111',
              borderRadius: '2px',
              marginTop: '4px',
              transition: 'background-color 0.15s',
            }}
            title="Потяните для изменения высоты списка моделей"
          />
        </div>
      )}
    </div>
  );
};
