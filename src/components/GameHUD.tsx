import React, { useState, useEffect } from 'react';
import { World } from '../ecs/World';
import { getAggregatedInteractionSlots } from '../ecs/utils/hierarchy';
import { t } from '../locales';
import { RetroSlotsHUD } from './gameHud/RetroSlotsHUD';
import { GameApp } from '../GameApp';

export interface GameHUDProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId?: string | null;
  onExitToEditor: () => void;
  onGotoSimulation: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  app,
  world,
  selectedEntityId,
  onExitToEditor,
  onGotoSimulation,
}) => {
  // Легкий интервал обновления текста HUD в реальном времени (10 раз в секунду)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % 10000);
    }, 100);
    return () => clearInterval(timer);
  }, []);

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
  let weaponName = t('hud.fists');
  if (playerId) {
    const aggSlots = getAggregatedInteractionSlots(world, playerId);
    for (const slotInfo of aggSlots) {
      if (slotInfo.slot.itemId) {
        const item = world.getComponent(slotInfo.slot.itemId, 'item');
        if (item?.type === 'weapon') {
          weaponName = item.name;
          break;
        }
      }
    }
  }

  const meta = playerId ? world.getComponent(playerId, 'meta') : null;
  const currentStance = meta?.stance;
  const stance =
    currentStance === 'airborne'
      ? t('hud.airborne')
      : currentStance === 'sliding'
        ? t('hud.sliding')
        : currentStance === 'prone'
          ? t('hud.prone')
          : currentStance === 'crouching'
            ? t('hud.crouching')
            : currentStance && currentStance.includes('_to_')
              ? t('hud.transition')
              : t('hud.standing');

  let moveMode = t('hud.immobile');
  if (meta?.movementMode === 'sprinting') {
    moveMode = t('hud.sprint');
  } else if (meta?.movementMode === 'jogging') {
    moveMode = t('hud.jog');
  } else if (meta?.movementMode === 'walking') {
    moveMode = t('hud.walk');
  } else if (meta?.movementMode === 'turning') {
    moveMode = t('hud.turning');
  } else if (meta?.movementMode === 'immobile') {
    moveMode = t('hud.immobile');
  }

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
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#3498db' }}>
            {t('hud.player')}
          </span>
          <span style={{ fontSize: '11px', color: '#aaa' }}>
            {stance} • {moveMode}
          </span>
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
          <span style={{ color: '#888' }}>{t('hud.weapon')}</span>
          <span style={{ fontWeight: 'bold', color: '#f39c12' }}>⚔️ {weaponName}</span>
        </div>
      </div>

      {/* Верхняя правая панель кнопок */}
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
          onClick={onGotoSimulation}
          style={{
            backgroundColor: 'rgba(39, 174, 96, 0.85)',
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27ae60')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(39, 174, 96, 0.85)')}
        >
          {t('hud.goToSimulation')}
        </button>
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
        >
          {t('hud.exitToEditor')}
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
          <strong style={{ color: '#fff' }}>WASD</strong> {t('hud.hintMove')}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Space</strong> {t('hud.hintJump')}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>F</strong> {t('hud.hintAttack')} (Прав)
        </span>
        <span>
          <strong style={{ color: '#fff' }}>G</strong> {t('hud.hintAttack')} (Лев)
        </span>
        <span>
          <strong style={{ color: '#fff' }}>1-5</strong> Слоты
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Shift</strong> {t('hud.hintSprint')}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Ctrl+LMB</strong> {t('hud.hintPickup')}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>C</strong> {t('hud.hintCrouch')}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>V</strong> {t('hud.hintProne')}
        </span>
      </div>

      {/* Ретро-интерфейс слотов взаимодействия и экипировки */}
      <RetroSlotsHUD app={app} world={world} selectedEntityId={selectedEntityId ?? null} />
    </>
  );
};
