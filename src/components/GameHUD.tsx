import React, { useState, useEffect, useRef } from 'react';
import { World } from '../ecs/World';
import { GameApp } from '../GameApp';

import { BlockQuests } from './gameHud/BlockQuests';
import { BlockEquipment } from './gameHud/BlockEquipment';
import { BlockLog } from './gameHud/BlockLog';
import { BlockToolbar } from './gameHud/BlockToolbar';
import { BlockMap } from './gameHud/BlockMap';
import { BlockStatus } from './gameHud/BlockStatus';
import { BlockCompass } from './gameHud/BlockCompass';
import { GameMenuModal } from './gameHud/GameMenuModal';
import { BlockTargetPanel } from './gameHud/BlockTargetPanel';
import { EntityInfoWindow } from './gameHud/EntityInfoWindow';
import { GAMEPLAY_CONFIG } from '../config/gameplayConfig';

export interface GameHUDProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId?: string | null;
  onExitToEditor: () => void;
  onGotoSimulation: () => void;
  onGotoMenu: () => void;
}

interface InfoWindowState {
  entityId: string;
  activeTab: string;
  zIndex: number;
  initialX: number;
  initialY: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  app,
  world,
  selectedEntityId,
  onExitToEditor,
  onGotoSimulation,
  onGotoMenu,
}) => {
  // Панели А, В, Д открыты по умолчанию при старте игры
  const [isQuestsOpen, setIsQuestsOpen] = useState(true);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);

  // Менеджер окон инфо осмотра
  const [infoWindows, setInfoWindows] = useState<InfoWindowState[]>([]);
  const maxZIndexRef = useRef<number>(100);

  const playerId = app ? app.getPlayerEntityId() : null;

  // Открытие окна осмотра (максимум 5 окон, LRU вытеснение, z-index всплытие)
  const handleOpenInspect = (targetEntityId: string) => {
    maxZIndexRef.current += 1;
    const newZ = maxZIndexRef.current;

    setInfoWindows((prev) => {
      const existingIdx = prev.findIndex((w) => w.entityId === targetEntityId);
      if (existingIdx !== -1) {
        // Окно уже есть: всплывает наверх, сохраняя активную вкладку
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], zIndex: newZ };
        return updated;
      }

      // Новое окно с каскадным сдвигом
      const cascadeCount = prev.length % GAMEPLAY_CONFIG.maxInfoWindows;
      const initialX =
        GAMEPLAY_CONFIG.infoWindowBasePos.x + cascadeCount * GAMEPLAY_CONFIG.infoWindowCascadeStep;
      const initialY =
        GAMEPLAY_CONFIG.infoWindowBasePos.y + cascadeCount * GAMEPLAY_CONFIG.infoWindowCascadeStep;

      const tag = world?.getComponent(targetEntityId, 'tag');
      const isCreature = tag?.archetype === 'creature';

      const newWindow: InfoWindowState = {
        entityId: targetEntityId,
        activeTab: isCreature ? 'status' : 'parameters',
        zIndex: newZ,
        initialX,
        initialY,
      };

      // LRU: если окон уже 5, закрываем самое старое (первое в массиве)
      if (prev.length >= GAMEPLAY_CONFIG.maxInfoWindows) {
        return [...prev.slice(1), newWindow];
      }
      return [...prev, newWindow];
    });
  };

  const handleCloseInspectWindow = (entityId: string) => {
    setInfoWindows((prev) => prev.filter((w) => w.entityId !== entityId));
  };

  const handleFocusInspectWindow = (entityId: string) => {
    maxZIndexRef.current += 1;
    const newZ = maxZIndexRef.current;
    setInfoWindows((prev) =>
      prev.map((w) => (w.entityId === entityId ? { ...w, zIndex: newZ } : w))
    );
  };

  const handleChangeInspectTab = (entityId: string, tab: string) => {
    setInfoWindows((prev) =>
      prev.map((w) => (w.entityId === entityId ? { ...w, activeTab: tab } : w))
    );
  };

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

      {/* Блок З: Панель цели справа (ракурс игрока, зум и кнопки действий) */}
      {selectedEntityId && selectedEntityId !== playerId && (
        <BlockTargetPanel
          app={app}
          world={world}
          targetId={selectedEntityId}
          onOpenInspect={handleOpenInspect}
        />
      )}

      {/* Окна детального осмотра ("ИНФО") */}
      {infoWindows.map((win) => (
        <EntityInfoWindow
          key={win.entityId}
          world={world}
          targetId={win.entityId}
          isCurrentlySelected={selectedEntityId === win.entityId}
          activeTab={win.activeTab}
          onChangeTab={(tab) => handleChangeInspectTab(win.entityId, tab)}
          onClose={() => handleCloseInspectWindow(win.entityId)}
          onFocus={() => handleFocusInspectWindow(win.entityId)}
          initialX={win.initialX}
          initialY={win.initialY}
          zIndex={win.zIndex}
        />
      ))}

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
