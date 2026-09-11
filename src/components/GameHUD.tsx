import React from 'react';
import { World } from '../ecs/World';

export interface GameHUDProps {
  world: World | null | undefined;
  onExitToEditor: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ world, onExitToEditor }) => {
  if (!world) return null;

  // Поиск сущности игрока (PlayerTree)
  const entities = world.getEntitiesWith('aiStats', 'health', 'transform');
  const playerEntry = entities.find(
    ([, comp]) => comp.aiStats.behavior.current === 'PlayerTree' && comp.health.isAlive
  );

  const playerComp = playerEntry ? playerEntry[1] : null;
  const playerId = playerEntry ? playerEntry[0] : null;

  const currentHp = playerComp ? Math.round(playerComp.health.current) : 0;
  const maxHp = playerComp ? Math.round(playerComp.health.max.current) : 100;
  const hpPercent = Math.max(0, Math.min(100, (currentHp / (maxHp || 1)) * 100));

  // Определение экипированного оружия
  let weaponName = 'Кулаки';
  if (playerId) {
    const equip = world.getComponent(playerId, 'equip');
    if (equip) {
      for (const slot of equip.interactionSlots) {
        if (slot.itemId) {
          const item = world.getComponent(slot.itemId, 'item');
          if (item?.type === 'weapon') {
            weaponName = item.name;
            break;
          }
        }
      }
    }
  }

  const meta = playerId ? world.getComponent(playerId, 'meta') : null;
  const stance = meta?.stance === 'crouching' ? 'Присед' : 'Стоя';
  const moveMode =
    meta?.movementMode === 'sprinting'
      ? 'Спринт'
      : meta?.movementMode === 'walking'
        ? 'Шаг'
        : 'Бег';

  return (
    <>
      {/* Верхняя левая панель: Статус персонажа */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          backgroundColor: 'rgba(18, 18, 18, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#fff',
          zIndex: 100,
          minWidth: '220px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#3498db' }}>🎮 Игрок</span>
          <span style={{ fontSize: '11px', color: '#aaa' }}>
            {stance} • {moveMode}
          </span>
        </div>

        {/* Полоска здоровья */}
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#888' }}>Здоровье:</span>
            <span style={{ fontWeight: 'bold', color: hpPercent > 25 ? '#2ecc71' : '#e74c3c' }}>
              {currentHp} / {maxHp}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${hpPercent}%`,
                height: '100%',
                backgroundColor: hpPercent > 25 ? '#2ecc71' : '#e74c3c',
                transition: 'width 0.2s ease, background-color 0.2s ease',
              }}
            />
          </div>
        </div>

        {/* Оружие */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            paddingTop: '4px',
            borderTop: '1px solid #2e2e2e',
          }}
        >
          <span style={{ color: '#888' }}>Оружие:</span>
          <span style={{ fontWeight: 'bold', color: '#f39c12' }}>⚔️ {weaponName}</span>
        </div>
      </div>

      {/* Верхняя правая кнопка выхода */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        <button
          onClick={onExitToEditor}
          style={{
            backgroundColor: 'rgba(192, 57, 43, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c0392b')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(192, 57, 43, 0.85)')}
          title="Вернуться в режим редактора"
        >
          [ESC] Выйти в редактор
        </button>
      </div>

      {/* Подсказка управления внизу по центру */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          borderRadius: '20px',
          padding: '6px 18px',
          color: '#aaa',
          fontSize: '11px',
          zIndex: 90,
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'flex',
          gap: '12px',
        }}
      >
        <span>
          <strong style={{ color: '#fff' }}>WASD</strong> Движение
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Пробел</strong> Атака
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Shift</strong> Спринт
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Ctrl+ЛКМ</strong> Подбор
        </span>
        <span>
          <strong style={{ color: '#fff' }}>C</strong> Присед
        </span>
      </div>
    </>
  );
};
