import React from 'react';
import { RETRO_PANEL_STYLE, RETRO_HEADER_STYLE, RETRO_BUTTON_STYLE } from './RetroStyles';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface GameMenuModalProps {
  isOpen: boolean;
  onResume: () => void;
  onSimulation: () => void;
  onEditor: () => void;
  onMainMenu: () => void;
}

export const GameMenuModal: React.FC<GameMenuModalProps> = ({
  isOpen,
  onResume,
  onSimulation,
  onEditor,
  onMainMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: HUD_CONFIG.menuModal.overlayBg,
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '300px',
          ...RETRO_PANEL_STYLE,
          padding: '6px',
        }}
      >
        <div style={RETRO_HEADER_STYLE}>
          <span>ИГРОВОЕ МЕНЮ</span>
          <span>ПАУЗА</span>
        </div>

        <div
          style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <button
            type="button"
            style={{ ...RETRO_BUTTON_STYLE, padding: '10px', fontSize: '15px' }}
            onClick={onResume}
          >
            ▶ ВЕРНУТЬСЯ В ИГРУ
          </button>

          <button
            type="button"
            style={{ ...RETRO_BUTTON_STYLE, padding: '10px', fontSize: '15px' }}
            onClick={onSimulation}
          >
            🔄 СИМУЛЯЦИЯ
          </button>

          <button
            type="button"
            style={{ ...RETRO_BUTTON_STYLE, padding: '10px', fontSize: '15px' }}
            onClick={onEditor}
          >
            🛠️ РЕДАКТОР
          </button>

          <button
            type="button"
            style={{
              ...RETRO_BUTTON_STYLE,
              padding: '10px',
              fontSize: '15px',
              color: HUD_CONFIG.menuModal.quitBtnText,
            }}
            onClick={onMainMenu}
          >
            🚪 ГЛАВНОЕ МЕНЮ
          </button>
        </div>
      </div>
    </div>
  );
};
