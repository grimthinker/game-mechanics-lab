import React from 'react';
import { RetroWindow } from './RetroWindow';
import { RETRO_SUNKEN_STYLE } from './RetroStyles';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface BlockQuestsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlockQuests: React.FC<BlockQuestsProps> = ({ isOpen, onClose }) => {
  return (
    <RetroWindow
      title="КВЕСТЫ [H]"
      isOpen={isOpen}
      onClose={onClose}
      initialX={16}
      initialY={232}
      initialWidth={260}
      initialHeight={230}
      minWidth={180}
      minHeight={140}
      storageKey="hud_window_quests"
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
        НЕТ АКТИВНЫХ ЗАДАНИЙ
      </div>
    </RetroWindow>
  );
};
