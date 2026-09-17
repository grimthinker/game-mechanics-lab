import React from 'react';
import { createPortal } from 'react-dom';
import { useDragDrop } from './DragDropContext';

export const DragGhostOverlay: React.FC = () => {
  const { isDragging, dragItem, cursorPosition, isValidTarget, isSwap, hoverTarget } =
    useDragDrop();

  if (!isDragging || !dragItem) return null;

  let borderColor = '#e74c3c'; // Красный (Запрет)
  let statusIcon = '🚫';

  if (isValidTarget) {
    borderColor = isSwap ? '#3498db' : '#2ecc71'; // Синий (Обмен) или Зеленый (Разрешено)
    statusIcon = isSwap ? '🔄' : '✅';
  }

  // Если курсор не над допустимой зоной сброса
  if (!hoverTarget) {
    borderColor = '#7f8c8d'; // Серый
    statusIcon = '...';
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: cursorPosition.x + 12,
        top: cursorPosition.y + 12,
        pointerEvents: 'none', // ВАЖНО: чтобы не перекрывать pointerenter у целевых элементов под курсором
        zIndex: 99999,
        backgroundColor: 'rgba(24, 24, 24, 0.95)',
        border: `1px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        color: '#fff',
        fontFamily: 'sans-serif',
        fontSize: '12px',
      }}
    >
      <span style={{ fontSize: '18px' }}>{dragItem.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 'bold', color: '#ecf0f1' }}>{dragItem.name}</span>
        <span style={{ fontSize: '10px', color: '#95a5a6', marginTop: '2px' }}>
          V: {dragItem.size} | {dragItem.weight}kg
        </span>
      </div>
      <span style={{ fontSize: '14px', marginLeft: '4px' }}>{statusIcon}</span>
    </div>,
    document.body
  );
};
