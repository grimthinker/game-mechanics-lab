import React from 'react';
import { RETRO_PANEL_STYLE, RETRO_BUTTON_STYLE, RETRO_BUTTON_PRESSED_STYLE } from './RetroStyles';

export interface BlockToolbarProps {
  isQuestsOpen: boolean;
  onToggleQuests: () => void;
  isLogOpen: boolean;
  onToggleLog: () => void;
  isMinimapOpen: boolean;
  onToggleMinimap: () => void;
  onOpenGameMenu: () => void;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  isQuestsOpen,
  onToggleQuests,
  isLogOpen,
  onToggleLog,
  isMinimapOpen,
  onToggleMinimap,
  onOpenGameMenu,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        ...RETRO_PANEL_STYLE,
        padding: '8px 10px',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <button
        type="button"
        style={isQuestsOpen ? RETRO_BUTTON_PRESSED_STYLE : RETRO_BUTTON_STYLE}
        onClick={onToggleQuests}
        title="КВЕСТЫ [H]"
      >
        📜 [H] КВЕСТЫ
      </button>

      <button
        type="button"
        style={isLogOpen ? RETRO_BUTTON_PRESSED_STYLE : RETRO_BUTTON_STYLE}
        onClick={onToggleLog}
        title="ЖУРНАЛ СООБЩЕНИЙ [J]"
      >
        💬 [J] ЖУРНАЛ
      </button>

      <button
        type="button"
        style={isMinimapOpen ? RETRO_BUTTON_PRESSED_STYLE : RETRO_BUTTON_STYLE}
        onClick={onToggleMinimap}
        title="МИНИКАРТА [K]"
      >
        🗺️ [K] КАРТА
      </button>

      <button
        type="button"
        style={RETRO_BUTTON_STYLE}
        onClick={onOpenGameMenu}
        title="ИГРОВОЕ МЕНЮ [ESC]"
      >
        ⚙️ [ESC] МЕНЮ
      </button>
    </div>
  );
};
