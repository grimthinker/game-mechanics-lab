import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  text: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text }) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords(null);
  };

  return (
    <span
      ref={iconRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '15px',
        height: '15px',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: isHovered ? '#3a3a3a' : '#2a2a2a',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '50%',
        cursor: 'help',
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0,
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      ℹ
      {coords &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${coords.top - 8}px`,
              left: `${coords.left}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: '#181818',
              color: '#ecf0f1',
              textAlign: 'left',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              lineHeight: '1.35',
              whiteSpace: 'normal',
              width: 'max-content',
              maxWidth: '220px',
              wordBreak: 'break-word',
              zIndex: 99999,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              pointerEvents: 'none',
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
};
