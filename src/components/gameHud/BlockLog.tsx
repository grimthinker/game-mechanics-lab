import React from 'react';
import { RetroWindow } from './RetroWindow';
import { RETRO_SUNKEN_STYLE } from './RetroStyles';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface BlockLogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlockLog: React.FC<BlockLogProps> = ({ isOpen, onClose }) => {
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 280 : 800;
  const defaultY = typeof window !== 'undefined' ? window.innerHeight - 246 : 600;

  return (
    <RetroWindow
      title="ЖУРНАЛ [J]"
      isOpen={isOpen}
      onClose={onClose}
      initialX={defaultX}
      initialY={defaultY}
      initialWidth={270}
      initialHeight={230}
      minWidth={200}
      minHeight={140}
      storageKey="hud_window_log"
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...RETRO_SUNKEN_STYLE,
          padding: 10,
          overflowY: 'auto',
          color: HUD_CONFIG.questsAndLog.emptyText,
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        ЖУРНАЛ СООБЩЕНИЙ ПУСТ...
      </div>
    </RetroWindow>
  );
};
