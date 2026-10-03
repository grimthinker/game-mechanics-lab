import React from 'react';
import { RetroWindow } from './RetroWindow';
import { RETRO_SUNKEN_STYLE } from './RetroStyles';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface BlockMapProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlockMap: React.FC<BlockMapProps> = ({ isOpen, onClose }) => {
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 240 : 800;

  return (
    <RetroWindow
      title="МИНИКАРТА [K]"
      isOpen={isOpen}
      onClose={onClose}
      initialX={defaultX}
      initialY={16}
      initialWidth={224}
      initialHeight={224}
      minWidth={160}
      minHeight={160}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...RETRO_SUNKEN_STYLE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: HUD_CONFIG.minimap.textPrimary,
          fontSize: '14px',
          gap: 6,
          backgroundColor: HUD_CONFIG.minimap.bg,
          backgroundImage: `radial-gradient(${HUD_CONFIG.minimap.gridDot} 15%, transparent 16%), radial-gradient(${HUD_CONFIG.minimap.gridDot} 15%, transparent 16%)`,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px',
        }}
      >
        <span style={{ fontSize: '26px' }}>🧭</span>
        <span style={{ fontWeight: 'bold' }}>КАРТА МЕСТНОСТИ</span>
        <span style={{ fontSize: '11px', color: HUD_CONFIG.minimap.textSecondary }}>
          [СЕКТОР ИССЛЕДУЕТСЯ]
        </span>
      </div>
    </RetroWindow>
  );
};
