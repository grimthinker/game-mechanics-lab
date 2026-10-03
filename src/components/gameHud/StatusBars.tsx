import React, { useState } from 'react';

export interface StatBarItem {
  id: string;
  icon: string;
  title: string;
  color: string;
  current: number;
  max: number;
}

export interface StatusBarsProps {
  bars: StatBarItem[];
  gap?: number;
  onBarClick?: (barId: string) => void;
}

export const StatusBars: React.FC<StatusBarsProps> = ({ bars, gap = 9, onBarClick }) => {
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, width: '100%' }}>
      {bars.map((bar) => {
        const ratio = Math.max(0, Math.min(1, bar.max > 0 ? bar.current / bar.max : 0));
        const isHovered = hoveredBarId === bar.id;

        return (
          <div
            key={bar.id}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '14px' }}
          >
            {/* Иконка с подсказкой названия */}
            <span
              style={{
                fontSize: '13px',
                lineHeight: '14px',
                height: '14px',
                cursor: 'help',
                flexShrink: 0,
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
              title={bar.title}
            >
              {bar.icon}
            </span>

            {/* Полоска с черным контуром без фасок */}
            <div
              onClick={() => onBarClick?.(bar.id)}
              onMouseEnter={() => setHoveredBarId(bar.id)}
              onMouseLeave={() => setHoveredBarId(null)}
              style={{
                flex: 1,
                height: '12px',
                backgroundColor: '#383838',
                border: '1px solid #141414',
                boxSizing: 'border-box',
                position: 'relative',
                cursor: onBarClick ? 'pointer' : 'default',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${ratio * 100}%`,
                  height: '100%',
                  backgroundColor: bar.color,
                  transition: 'width 0.2s ease-out',
                }}
              />

              {/* Отображение значений при наведении */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    lineHeight: '10px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    pointerEvents: 'none',
                    textShadow: '0 0 2px #000',
                  }}
                >
                  {bar.current} / {bar.max}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
