import React from 'react';
import { WeaponConfig, ArmorConfig, InventoryConfig, ItemData } from '../ecs/types';
import { CreatureStats } from '../types';
import { GameMode, THEME_COLORS } from '../constants';

interface ToolbarProps {
  mode: GameMode;
  goToEditor: () => void;
  goToSimulation: () => void;
  goToGame: (id: string) => void;
  obstaclesEnabled: boolean;
  setObstaclesEnabled: (val: boolean) => void;
  setObstaclesData: (data: any[]) => void;
  selectedStats: CreatureStats | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  worldFileInputRef: React.RefObject<HTMLInputElement | null>;
  onNewWorld: () => void;
  onSaveWorld: () => void;
  onLoadWorldFile: (file: File) => void;
  openSpawnModal: (type: 'player' | 'ai') => void;
  openEditModal: () => void;
  handleDeleteCreature: () => void;
  openItemEditModal: (item: ItemData) => void;
  isPaused: boolean; 
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  goToEditor,
  goToSimulation,
  goToGame,
  obstaclesEnabled,
  setObstaclesEnabled,
  selectedStats,
  fileInputRef,
  worldFileInputRef,
  onNewWorld,
  onSaveWorld,
  onLoadWorldFile,
  openSpawnModal,
  openEditModal,
  handleDeleteCreature,
  openItemEditModal,
  isPaused
}) => {
  const getSlotTypeName = (type: string) => {
    switch (type) {
      case 'armor': return 'Броня';
      case 'bag': return 'Сумка';
      case 'weapon': return 'Оружие';
      default: return type;
    }
  };

  return (
    <div id="toolbar" style={{ backgroundColor: THEME_COLORS[mode] }}>
      <div className="tool-group">
        <h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%' }}>
                <span>Мир</span>
                {isPaused && mode !== GameMode.GAME && (
                    <span style={{ 
                        color: '#e74c3c', 
                        fontWeight: 'bold', 
                        fontSize: '14px',
                        padding: '2px 8px',
                        border: '1px solid #e74c3c',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        position: 'absolute',
                        right: 0
                    }}>
                        ПАУЗА
                    </span>
                )}
            </div>
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mode === GameMode.EDITOR && (
            <>
              <button className="btn" onClick={onNewWorld}>Новый мир</button>
              <button className="btn" onClick={onSaveWorld}>Сохранить мир</button>
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
              <button className="btn" onClick={() => worldFileInputRef.current?.click()}>Загрузить мир</button>
            </>
          )}
          {mode !== GameMode.EDITOR && (
            <button className="btn" style={{ backgroundColor: '#2980b9', color: '#fff' }} onClick={goToEditor}>Редактор</button>
          )}
          {mode !== GameMode.SIMULATION && (
            <button className="btn" style={{ backgroundColor: '#27ae60', color: '#fff' }} onClick={goToSimulation}>Симуляция</button>
          )}
        </div>
      </div>

      {mode === GameMode.EDITOR && (
        <div className="tool-group">
          <h3>Управление спавном</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openSpawnModal('player')}>
              Добавить Игрока
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openSpawnModal('ai')}>
              Добавить Бота
            </button>
          </div>
        </div>
      )}

      <div className="tool-group">
        <h3>Препятствия</h3>
        <label>
          Включить коллизии
          <input
            type="checkbox"
            checked={obstaclesEnabled}
            onChange={(e) => setObstaclesEnabled(e.target.checked)}
          />
        </label>
        {mode === GameMode.EDITOR && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const data = JSON.parse(evt.target?.result as string);
                    if (Array.isArray(data)) {
                      // запуск загрузки препятствий
                    }
                  } catch {
                    alert('Ошибка при чтении JSON файла!');
                  }
                };
                reader.readAsText(file);
              }}
            />
            <button className="btn" onClick={() => fileInputRef.current?.click()}>Загрузить JSON препятствий</button>
          </>
        )}
      </div>

      <div className="tool-group">
        <h3>{mode === GameMode.GAME ? 'Игрок' : 'Выбранное существо'}</h3>
        {selectedStats ? (
          <div className="stats-list">
            <dl className="stats-list">
              <div className="stat-row"><dt>Тип:</dt><dd>{selectedStats.type === 'player' ? 'Игрок' : 'Бот'}</dd></div>
              <div className="stat-row"><dt>Состояние:</dt><dd>{selectedStats.state}</dd></div>
              <div className="stat-row"><dt>Радиус:</dt><dd>{selectedStats.radius} px</dd></div>
              <div className="stat-row"><dt>Масса:</dt><dd>{selectedStats.mass}</dd></div>
              <div className="stat-row"><dt>Здоровье (HP):</dt><dd>{selectedStats.hp} / {selectedStats.maxHp}</dd></div>
              <div className="stat-row"><dt>Текущая скорость:</dt><dd>{selectedStats.currentSpeed.toFixed(0)} px/с</dd></div>
              <div className="stat-row"><dt>Текущий поворот:</dt><dd>{selectedStats.currentTurnSpeed.toFixed(0)} °/с</dd></div>
              <div className="stat-row"><dt>Макс. скорость:</dt><dd>{selectedStats.maxSpeed} px/с</dd></div>
              <div className="stat-row"><dt>Макс. поворот:</dt><dd>{selectedStats.maxTurnSpeed} °/с</dd></div>
            </dl>

            <h4 style={{ marginTop: '12px', fontSize: '13px', color: '#bdc3c7' }}>
              Экипировка:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {selectedStats.equipSlots.map((slot: { item: any; type: string; }, index: any) => {
                const item = slot.item;
                const hasEditableItem = item && ['weapon', 'armor', 'bag'].includes(item.type) && !!item.config;
                const isWeapon = item?.type === 'weapon';
                const isArmor = item?.type === 'armor';
                const isBag = item?.type === 'bag';

                return (
                  <div
                    key={`${slot.type}_${index}`}
                    onClick={() => { if (hasEditableItem && item) openItemEditModal(item); }}
                    style={{
                      backgroundColor: '#1e1e1e',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: hasEditableItem ? 'pointer' : 'default',
                      fontSize: '12px',
                      border: '1px solid #444',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: '#aaa' }}>{getSlotTypeName(slot.type)}:</span>
                    <span>
                      {item ? item.name : 'Пусто'}
                      {isWeapon && item?.config && (
                        <span style={{ color: '#f1c40f', marginLeft: '6px' }}>
                          ({(item.config as WeaponConfig).baseDamage} урона)
                        </span>
                      )}
                      {isArmor && item?.config && (
                        <span style={{ color: '#3498db', marginLeft: '6px' }}>
                          ({(item.config as ArmorConfig).defense} защиты)
                        </span>
                      )}
                      {isBag && item?.config && (
                        <span style={{ color: '#2ecc71', marginLeft: '6px' }}>
                          ({(item.config as InventoryConfig).size.width}x{(item.config as InventoryConfig).size.height})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {mode === GameMode.EDITOR && (
                <>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={openEditModal}>Изменить</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: '#c0392b' }} onClick={handleDeleteCreature}>Удалить</button>
                </>
              )}
              {mode === GameMode.SIMULATION && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={openEditModal}>Осмотреть</button>
              )}
            </div>

            {(mode === GameMode.EDITOR || mode === GameMode.SIMULATION) && selectedStats.type === 'player' && (
              <button 
                className="btn" 
                style={{ width: '100%', marginTop: '8px', backgroundColor: '#8e44ad', color: '#fff' }} 
                onClick={() => goToGame(selectedStats.id)}
              >
                Играть
              </button>
            )}
          </div>
        ) : (
          <p className="selection-hint">Существо не выбрано</p>
        )}
      </div>

      <div className="tool-group">
        <h3>Управление</h3>
        {mode === GameMode.GAME ? (
          <ul className="control-keys">
            <li><kbd>W</kbd> Движение вперед</li>
            <li><kbd>A</kbd> / <kbd>D</kbd> Поворот влево/вправо</li>
            <li><kbd>LShift</kbd> Бег (удержание)</li>
            <li><kbd>C</kbd> Полуприсяд (удержание)</li>
            <li><kbd>Пробел</kbd> Атака оружием</li>
          </ul>
        ) : mode === GameMode.SIMULATION ? (
          <ul className="control-keys">
            <li><kbd>Пробел</kbd> Пауза / Возобновление симуляции</li>
            <li><kbd>U</kbd> Дерево поведения (BT)</li>
          </ul>
        ) : (
          <ul className="control-keys">
            <li><kbd>U</kbd> Дерево поведения (BT)</li>
            <li><kbd>Ctrl+B</kbd> Быстрый спавн бота</li>
            <li><kbd>Ctrl+P</kbd> Быстрый спавн игрока</li>
          </ul>
        )}
      </div>
    </div>
  );
};
