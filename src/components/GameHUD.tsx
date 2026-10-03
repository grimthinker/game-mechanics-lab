import React, { useState, useEffect } from 'react';
import { World } from '../ecs/World';
import { getAggregatedInteractionSlots } from '../ecs/utils/hierarchy';
import { t } from '../locales';
import { RetroSlotsHUD } from './gameHud/RetroSlotsHUD';
import { GameApp } from '../GameApp';

import { BlockQuests } from './gameHud/BlockQuests';
import { BlockEquipment } from './gameHud/BlockEquipment';
import { BlockLog } from './gameHud/BlockLog';
import { BlockToolbar } from './gameHud/BlockToolbar';
import { BlockMap } from './gameHud/BlockMinimap';
import { BlockStatus } from './gameHud/BlockStatus';
import { BlockCompass } from './gameHud/BlockCompass';
import { GameMenuModal } from './gameHud/GameMenuModal';

export interface GameHUDProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId?: string | null;
  onExitToEditor: () => void;
  onGotoSimulation: () => void;
  onGotoMenu: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  app,
  world,
  onExitToEditor,
  onGotoSimulation,
  onGotoMenu,
}) => {
  // Панели А, В, Д открыты по умолчанию при старте игры
  const [isQuestsOpen, setIsQuestsOpen] = useState(true);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);

  const playerId = app ? app.getPlayerEntityId() : null;

  // Управление паузой при открытии/закрытии Игрового меню
  const openGameMenu = () => {
    if (app) app.isPaused = true;
    setIsGameMenuOpen(true);
  };

  const closeGameMenu = () => {
    if (app) app.isPaused = false;
    setIsGameMenuOpen(false);
  };

  // Обработка горячих клавиш: H, J, K, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isGameMenuOpen) {
          closeGameMenu();
        } else {
          openGameMenu();
        }
        return;
      }

      if (isGameMenuOpen) return; // во время паузы меню блокируем открытие других панелей

      if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsQuestsOpen((prev) => !prev);
      } else if (e.code === 'KeyJ' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsLogOpen((prev) => !prev);
      } else if (e.code === 'KeyK' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsMinimapOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isGameMenuOpen, app]);

  if (!world) return null;

  return (
    <>
      {/* Блок Е: Параметры игрока + кукла анатомии (верхний левый угол) */}
      <BlockStatus world={world} playerId={playerId} />

      {/* Блок Ж: Компас направлений сторон света (верхний центр) */}
      <BlockCompass camera={app?.camera} />

      {/* Блок Д: Миникарта (верхний правый угол) */}
      <BlockMap isOpen={isMinimapOpen} onClose={() => setIsMinimapOpen(false)} />

      {/* Блок А: Активные квесты (средний левый край) */}
      <BlockQuests isOpen={isQuestsOpen} onClose={() => setIsQuestsOpen(false)} />

      {/* Блок Б: Слоты взаимодействия и области экипировки (центр снизу) */}
      <BlockEquipment app={app} world={world} playerId={playerId} />

      {/* Блок В: Журнал сообщений и диалогов (нижний правый угол) */}
      <BlockLog isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />

      {/* Блок Г: Панель управляющих кнопок [H], [J], [K], [Esc] (нижний левый угол) */}
      <BlockToolbar
        isQuestsOpen={isQuestsOpen}
        onToggleQuests={() => setIsQuestsOpen((prev) => !prev)}
        isLogOpen={isLogOpen}
        onToggleLog={() => setIsLogOpen((prev) => !prev)}
        isMinimapOpen={isMinimapOpen}
        onToggleMinimap={() => setIsMinimapOpen((prev) => !prev)}
        onOpenGameMenu={openGameMenu}
      />

      {/* Модальное окно Игрового меню с паузой и сильным размытием сцены */}
      <GameMenuModal
        isOpen={isGameMenuOpen}
        onResume={closeGameMenu}
        onSimulation={() => {
          closeGameMenu();
          onGotoSimulation();
        }}
        onEditor={() => {
          closeGameMenu();
          onExitToEditor();
        }}
        onMainMenu={() => {
          closeGameMenu();
          onGotoMenu();
        }}
      />
    </>
  );
};
