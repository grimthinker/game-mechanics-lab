import React, { useState } from 'react';
import { PieMenuItem } from './types';
import { Point } from '../../types';

export interface PieMenuProps {
  position: Point;
  title?: string;
  items: PieMenuItem[];
  onClose: () => void;
}

export const PieMenu: React.FC<PieMenuProps> = ({ position, title, items, onClose }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const numItems = items.length;
  if (numItems === 0) return null;

  const outerRadius = 115;
  const innerRadius = 42;
  const centerRadius = 32;

  // Расчет SVG-пути кругового сектора (Arc Slice)
  const getSectorPath = (index: number): string => {
    const anglePerItem = (Math.PI * 2) / numItems;
    // Смещение на -90 градусов, чтобы первый сектор начинался сверху
    const startAngle = index * anglePerItem - Math.PI / 2;
    const endAngle = (index + 1) * anglePerItem - Math.PI / 2;

    const x1 = Math.cos(startAngle) * outerRadius;
    const y1 = Math.sin(startAngle) * outerRadius;
    const x2 = Math.cos(endAngle) * outerRadius;
    const y2 = Math.sin(endAngle) * outerRadius;

    const ix1 = Math.cos(startAngle) * innerRadius;
    const iy1 = Math.sin(startAngle) * innerRadius;
    const ix2 = Math.cos(endAngle) * innerRadius;
    const iy2 = Math.sin(endAngle) * innerRadius;

    const largeArc = anglePerItem > Math.PI ? 1 : 0;

    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  // Расчет положения текста и иконки по центру сектора
  const getItemCenterPos = (index: number) => {
    const anglePerItem = (Math.PI * 2) / numItems;
    const midAngle = (index + 0.5) * anglePerItem - Math.PI / 2;
    const r = (innerRadius + outerRadius) / 2;
    return {
      x: Math.cos(midAngle) * r,
      y: Math.sin(midAngle) * r,
    };
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        width: outerRadius * 2 + 40,
        height: outerRadius * 2 + 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Заголовок меню */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 15, 15, 0.95)',
            border: '1px solid #444',
            borderRadius: '12px',
            padding: '3px 10px',
            color: '#3498db',
            fontSize: '11px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          {title}
        </div>
      )}

      <svg
        width={outerRadius * 2 + 20}
        height={outerRadius * 2 + 20}
        viewBox={`${-outerRadius - 10} ${-outerRadius - 10} ${(outerRadius + 10) * 2} ${(outerRadius + 10) * 2}`}
        style={{ overflow: 'visible', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.7))' }}
      >
        {/* Секторы радиального меню */}
        {items.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const pos = getItemCenterPos(idx);
          const baseFill = item.danger ? 'rgba(192, 57, 43, 0.85)' : 'rgba(28, 28, 28, 0.92)';
          const hoverFill = item.danger ? '#e74c3c' : item.color || '#2980b9';

          return (
            <g
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                item.onSelect();
                onClose();
              }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              <path
                d={getSectorPath(idx)}
                fill={isHovered ? hoverFill : baseFill}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth={isHovered ? 2 : 1}
                style={{
                  transition: 'fill 0.12s ease, stroke 0.12s ease',
                }}
              />
              <text
                x={pos.x}
                y={pos.y - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="18px"
                pointerEvents="none"
              >
                {item.icon}
              </text>
              <text
                x={pos.x}
                y={pos.y + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10px"
                fontWeight={isHovered ? 'bold' : 'normal'}
                fill="#ffffff"
                pointerEvents="none"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Центральный круг отмены */}
        <g
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx={0}
            cy={0}
            r={centerRadius}
            fill="#151515"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1.5}
            style={{ transition: 'fill 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.fill = '#2c3e50')}
            onMouseLeave={(e) => (e.currentTarget.style.fill = '#151515')}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#888888"
            fontSize="14px"
            fontWeight="bold"
            pointerEvents="none"
          >
            ✕
          </text>
        </g>
      </svg>
    </div>
  );
};
