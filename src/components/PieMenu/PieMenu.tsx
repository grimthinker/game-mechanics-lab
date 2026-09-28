import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PieMenuItem } from './types';
import { Point } from '../../types';
import { PIE_MENU_CONFIG } from '../../config/pieMenuConfig';

export interface PieMenuProps {
  position: Point;
  title?: string;
  items: PieMenuItem[];
  onClose: () => void;
}

export const PieMenu: React.FC<PieMenuProps> = ({ position, title, items, onClose }) => {
  const [hoveredPrimaryIndex, setHoveredPrimaryIndex] = useState<number | null>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [hoveredSubmenuIndex, setHoveredSubmenuIndex] = useState<number | null>(null);
  const [hoveredNav, setHoveredNav] = useState<'prev' | 'next' | null>(null);
  const [pageOffset, setPageOffset] = useState<number>(0);

  const numPrimaryItems = items.length;
  if (numPrimaryItems === 0) return null;

  const hasNestedSubmenus = items.some((it) => it.children && it.children.length > 0);

  // Радиусы колец из конфига
  const innerR = hasNestedSubmenus ? PIE_MENU_CONFIG.innerRingInnerRadius : 42;
  const outerR = hasNestedSubmenus ? PIE_MENU_CONFIG.innerRingOuterRadius : 115;
  const subInnerR = PIE_MENU_CONFIG.outerArcInnerRadius;
  const subOuterR = PIE_MENU_CONFIG.outerArcOuterRadius;
  const centerRadius = PIE_MENU_CONFIG.centerRadius;

  const viewRadius = hasNestedSubmenus ? subOuterR + 25 : outerR + 20;

  // Вспомогательная функция для построения пути кольцевого сектора
  const createArcSectorPath = (
    startAngle: number,
    endAngle: number,
    rIn: number,
    rOut: number
  ): string => {
    let diff = endAngle - startAngle;
    while (diff < 0) diff += Math.PI * 2;
    while (diff > Math.PI * 2) diff -= Math.PI * 2;

    const x1 = Math.cos(startAngle) * rOut;
    const y1 = Math.sin(startAngle) * rOut;
    const x2 = Math.cos(endAngle) * rOut;
    const y2 = Math.sin(endAngle) * rOut;

    const ix1 = Math.cos(startAngle) * rIn;
    const iy1 = Math.sin(startAngle) * rIn;
    const ix2 = Math.cos(endAngle) * rIn;
    const iy2 = Math.sin(endAngle) * rIn;

    const largeArc = diff > Math.PI ? 1 : 0;

    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${rIn} ${rIn} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  // Расчет углов секторов первого кольца (на 360 градусов)
  const getPrimarySectorAngles = (index: number) => {
    const anglePerItem = (Math.PI * 2) / numPrimaryItems;
    const startAngle = index * anglePerItem - Math.PI / 2;
    const endAngle = (index + 1) * anglePerItem - Math.PI / 2;
    const midAngle = (index + 0.5) * anglePerItem - Math.PI / 2;
    return { startAngle, endAngle, midAngle };
  };

  // Колесо мыши: циклическая прокрутка активного веера
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeCategoryIndex === null) return;
      const subItems = items[activeCategoryIndex]?.children;
      if (!subItems || subItems.length <= PIE_MENU_CONFIG.maxVisibleSubmenuItems) return;

      const total = subItems.length;
      if (e.deltaY > 0) {
        setPageOffset((prev) => (prev + 1) % total);
      } else if (e.deltaY < 0) {
        setPageOffset((prev) => (prev - 1 + total) % total);
      }
    },
    [activeCategoryIndex, items]
  );

  // Выбранная категория и её подменю
  const activeCategory = activeCategoryIndex !== null ? items[activeCategoryIndex] : null;
  const rawSubmenuItems = activeCategory?.children || [];
  const totalSubmenuCount = rawSubmenuItems.length;
  const isPaginationNeeded = totalSubmenuCount > PIE_MENU_CONFIG.maxVisibleSubmenuItems;

  const visibleCount = Math.min(totalSubmenuCount, PIE_MENU_CONFIG.maxVisibleSubmenuItems);

  // Срез отображаемых элементов с циклическим смещением
  const currentSubmenuSlice: Array<{ item: PieMenuItem; originalIndex: number }> = [];
  for (let i = 0; i < visibleCount; i++) {
    const idx = (pageOffset + i) % totalSubmenuCount;
    currentSubmenuSlice.push({ item: rawSubmenuItems[idx], originalIndex: idx });
  }

  // Расчет дуги веера второго уровня:
  // Центр дуги совпадает с центральным углом выбранного сектора категории (midAngle).
  // Размах дуги строго не превышает 180 градусов (PI радиан).
  let submenuArcStart = 0;
  let submenuSliceAngle = 0;
  let prevButtonStart = 0;
  let prevButtonEnd = 0;
  let nextButtonStart = 0;
  let nextButtonEnd = 0;

  if (activeCategoryIndex !== null && visibleCount > 0) {
    const { midAngle } = getPrimarySectorAngles(activeCategoryIndex);
    const navAngle = isPaginationNeeded ? PIE_MENU_CONFIG.navButtonAngle : 0;
    const maxItemsArc = PIE_MENU_CONFIG.maxSubmenuArcAngle - navAngle * 2;

    // Сектор на один элемент веера
    const anglePerItem = Math.min(Math.PI / 4, maxItemsArc / visibleCount);
    const totalItemsSpan = anglePerItem * visibleCount;
    const totalArcSpan = totalItemsSpan + navAngle * 2;

    const fullArcStart = midAngle - totalArcSpan / 2;

    if (isPaginationNeeded) {
      prevButtonStart = fullArcStart;
      prevButtonEnd = fullArcStart + navAngle;

      submenuArcStart = prevButtonEnd;
      submenuSliceAngle = anglePerItem;

      nextButtonStart = submenuArcStart + totalItemsSpan;
      nextButtonEnd = nextButtonStart + navAngle;
    } else {
      submenuArcStart = fullArcStart;
      submenuSliceAngle = anglePerItem;
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'auto',
        backgroundColor: 'transparent',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: viewRadius * 2 + 40,
          height: viewRadius * 2 + 40,
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
              top: -(viewRadius - 70),
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
            {activeCategory ? `${title} › ${activeCategory.label}` : title}
          </div>
        )}

        <svg
          width={viewRadius * 2 + 20}
          height={viewRadius * 2 + 20}
          viewBox={`${-viewRadius - 10} ${-viewRadius - 10} ${(viewRadius + 10) * 2} ${(viewRadius + 10) * 2}`}
          style={{ overflow: 'visible', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.75))' }}
        >
          {/* 1. Внутреннее кольцо (Категории или одиночные команды) */}
          {items.map((item, idx) => {
            const { startAngle, endAngle, midAngle } = getPrimarySectorAngles(idx);
            const isHovered = hoveredPrimaryIndex === idx;
            const isSelectedCategory = activeCategoryIndex === idx;

            const baseFill = item.danger
              ? 'rgba(192, 57, 43, 0.88)'
              : isSelectedCategory
                ? '#2980b9'
                : 'rgba(28, 28, 28, 0.94)';
            const hoverFill = item.danger
              ? '#e74c3c'
              : item.color || (item.children ? '#3498db' : '#27ae60');

            const rMid = (innerR + outerR) / 2;
            const posX = Math.cos(midAngle) * rMid;
            const posY = Math.sin(midAngle) * rMid;

            return (
              <g
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.children && item.children.length > 0) {
                    if (activeCategoryIndex === idx) {
                      setActiveCategoryIndex(null);
                    } else {
                      setActiveCategoryIndex(idx);
                      setPageOffset(0);
                    }
                  } else if (item.onSelect) {
                    item.onSelect();
                    onClose();
                  }
                }}
                onMouseEnter={() => setHoveredPrimaryIndex(idx)}
                onMouseLeave={() => setHoveredPrimaryIndex(null)}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <path
                  d={createArcSectorPath(startAngle, endAngle, innerR, outerR)}
                  fill={isHovered ? hoverFill : baseFill}
                  stroke={isSelectedCategory ? '#5dade2' : 'rgba(255, 255, 255, 0.18)'}
                  strokeWidth={isSelectedCategory ? 2.5 : isHovered ? 2 : 1}
                  style={{ transition: 'fill 0.12s ease, stroke 0.12s ease' }}
                />
                <text
                  x={posX}
                  y={posY - 7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18px"
                  pointerEvents="none"
                >
                  {item.icon}
                </text>
                <text
                  x={posX}
                  y={posY + 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10px"
                  fontWeight={isHovered || isSelectedCategory ? 'bold' : 'normal'}
                  fill="#ffffff"
                  pointerEvents="none"
                >
                  {item.label}
                </text>
              </g>
            );
          })}

          {/* 2. Внешний веер подменю (раскрывается по клику на категорию) */}
          {activeCategoryIndex !== null && visibleCount > 0 && (
            <g>
              {/* Кнопка сдвига назад (◀) */}
              {isPaginationNeeded && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    const total = rawSubmenuItems.length;
                    setPageOffset((prev) => (prev - 1 + total) % total);
                  }}
                  onMouseEnter={() => setHoveredNav('prev')}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <path
                    d={createArcSectorPath(prevButtonStart, prevButtonEnd, subInnerR, subOuterR)}
                    fill={hoveredNav === 'prev' ? '#2980b9' : 'rgba(38, 38, 38, 0.94)'}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={hoveredNav === 'prev' ? 2 : 1}
                  />
                  {(() => {
                    const mid = (prevButtonStart + prevButtonEnd) / 2;
                    const rMid = (subInnerR + subOuterR) / 2;
                    return (
                      <text
                        x={Math.cos(mid) * rMid}
                        y={Math.sin(mid) * rMid}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize="14px"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        ◀
                      </text>
                    );
                  })()}
                </g>
              )}

              {/* Отображаемые секторы элементов категории (максимум 6) */}
              {currentSubmenuSlice.map(({ item, originalIndex }, sliceIdx) => {
                const startA = submenuArcStart + sliceIdx * submenuSliceAngle;
                const endA = startA + submenuSliceAngle;
                const midA = (startA + endA) / 2;
                const rMid = (subInnerR + subOuterR) / 2;

                const posX = Math.cos(midA) * rMid;
                const posY = Math.sin(midA) * rMid;

                const isHovered = hoveredSubmenuIndex === sliceIdx;
                const baseFill = item.danger ? 'rgba(192, 57, 43, 0.88)' : 'rgba(32, 32, 32, 0.95)';
                const hoverFill = item.danger ? '#e74c3c' : item.color || '#27ae60';

                return (
                  <g
                    key={`${item.id}_${originalIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.onSelect) item.onSelect();
                      onClose();
                    }}
                    onMouseEnter={() => setHoveredSubmenuIndex(sliceIdx)}
                    onMouseLeave={() => setHoveredSubmenuIndex(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <path
                      d={createArcSectorPath(startA, endA, subInnerR, subOuterR)}
                      fill={isHovered ? hoverFill : baseFill}
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth={isHovered ? 2 : 1}
                      style={{ transition: 'fill 0.12s ease' }}
                    />
                    <text
                      x={posX}
                      y={posY - 7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="18px"
                      pointerEvents="none"
                    >
                      {item.icon}
                    </text>
                    <text
                      x={posX}
                      y={posY + 11}
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

              {/* Кнопка сдвига вперед (▶) */}
              {isPaginationNeeded && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    const total = rawSubmenuItems.length;
                    setPageOffset((prev) => (prev + 1) % total);
                  }}
                  onMouseEnter={() => setHoveredNav('next')}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <path
                    d={createArcSectorPath(nextButtonStart, nextButtonEnd, subInnerR, subOuterR)}
                    fill={hoveredNav === 'next' ? '#2980b9' : 'rgba(38, 38, 38, 0.94)'}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={hoveredNav === 'next' ? 2 : 1}
                  />
                  {(() => {
                    const mid = (nextButtonStart + nextButtonEnd) / 2;
                    const rMid = (subInnerR + subOuterR) / 2;
                    return (
                      <text
                        x={Math.cos(mid) * rMid}
                        y={Math.sin(mid) * rMid}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize="14px"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        ▶
                      </text>
                    );
                  })()}
                </g>
              )}
            </g>
          )}

          {/* 3. Центральный круг отмены (✕) */}
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
    </div>,
    document.body
  );
};
