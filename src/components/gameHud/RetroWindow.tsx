import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RETRO_PANEL_STYLE, RETRO_HEADER_STYLE } from './RetroStyles';

export interface RetroWindowProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  zIndex?: number;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  isOpen,
  onClose,
  initialX,
  initialY,
  initialWidth,
  initialHeight,
  minWidth = 180,
  minHeight = 140,
  children,
  zIndex = 90,
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(
    null
  );
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Коррекция позиции при изменении размеров экрана
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.max(0, Math.min(window.innerWidth - size.width, prev.x)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: pos.x,
        posY: pos.y,
      };

      const handleMouseMove = (moveEvt: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = moveEvt.clientX - dragRef.current.startX;
        const dy = moveEvt.clientY - dragRef.current.startY;
        const nextX = Math.max(
          0,
          Math.min(window.innerWidth - size.width, dragRef.current.posX + dx)
        );
        const nextY = Math.max(
          0,
          Math.min(window.innerHeight - size.height, dragRef.current.posY + dy)
        );
        setPos({ x: nextX, y: nextY });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [pos, size]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: size.width,
        startH: size.height,
      };

      const handleMouseMove = (moveEvt: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = moveEvt.clientX - resizeRef.current.startX;
        const dy = moveEvt.clientY - resizeRef.current.startY;
        const nextW = Math.max(
          minWidth,
          Math.min(window.innerWidth - pos.x, resizeRef.current.startW + dx)
        );
        const nextH = Math.max(
          minHeight,
          Math.min(window.innerHeight - pos.y, resizeRef.current.startH + dy)
        );
        setSize({ width: nextW, height: nextH });
      };

      const handleMouseUp = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [pos, size, minWidth, minHeight]
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        ...RETRO_PANEL_STYLE,
        padding: '6px 6px 14px 6px',
        zIndex,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Шапка для перетаскивания окна (находится внутри фаски панели) */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          ...RETRO_HEADER_STYLE,
          cursor: 'move',
          marginBottom: '6px',
        }}
      >
        <span>{title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 4px',
            fontFamily: 'inherit',
          }}
          title="СКРЫТЬ"
        >
          ✕
        </button>
      </div>

      {/* Контент окна */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>

      {/* Уголок масштабирования размера окна (Resize Handle): расположен в полосе между светлой фаской контента и темной фаской окна */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          right: 3,
          bottom: 2,
          width: 11,
          height: 11,
          cursor: 'se-resize',
          zIndex: 15,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          fontSize: '10px',
          color: '#222222',
          lineHeight: '10px',
          userSelect: 'none',
        }}
        title="Потяните для изменения размера"
      >
        ◢
      </div>
    </div>
  );
};
