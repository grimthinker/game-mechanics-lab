import React from 'react';
import { BTNodeDTO } from '../ai/core';
import { BTGraph } from './BTGraph';

interface BTPanelProps {
  btPanelWidth: number;
  blackboardHeight: number;
  btData: BTNodeDTO | null;
  btBlackboard: Record<string, any> | null;
  onClose: () => void;
  onResizeBTStart: () => void;
  onResizeBBStart: () => void;
  isResizingBT: boolean;
  isResizingBB: boolean;
}

export const BTPanel: React.FC<BTPanelProps> = ({
  btPanelWidth,
  blackboardHeight,
  btData,
  btBlackboard,
  onClose,
  onResizeBTStart,
  onResizeBBStart,
  isResizingBT,
  isResizingBB,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${btPanelWidth}px`,
        backgroundColor: '#181818',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
        boxShadow: '4px 0 15px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '14px',
        }}
      >
        <span>🌳 Дерево поведения (BT)</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', position: 'relative', padding: '10px' }}>
        {btData ? (
          <BTGraph tree={btData} showStatus={true} />
        ) : (
          <div style={{ color: '#aaa', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
            У выбранного существа нет дерева поведения
          </div>
        )}
      </div>

      <div
        onMouseDown={onResizeBBStart}
        style={{
          height: '6px',
          backgroundColor: isResizingBB ? '#2196f3' : '#2a2a2a',
          cursor: 'row-resize',
          transition: 'background-color 0.2s',
          borderTop: '1px solid #3a3a3a',
          borderBottom: '1px solid #111',
        }}
        title="Зажмите и перетащите для изменения высоты окна памяти"
      />

      <div
        style={{
          padding: '12px 14px',
          backgroundColor: '#141414',
          flex: `0 0 ${blackboardHeight}px`,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            color: '#ffcc00',
            marginBottom: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🧠 Память бота (Blackboard)</span>
        </div>
        {btBlackboard && Object.keys(btBlackboard).length > 0 ? (
          Object.entries(btBlackboard).map(([key, value]) => (
            <div
              key={key}
              style={{
                borderBottom: '1px solid #2a2a2a',
                padding: '6px 0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <span style={{ color: '#64b5f6' }}>{key}:</span>
              <span style={{ color: '#a5d6a7', wordBreak: 'break-all', textAlign: 'right' }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: '#777', fontStyle: 'italic', padding: '4px 0' }}>Память пуста или недоступна</div>
        )}
      </div>

      <div
        onMouseDown={onResizeBTStart}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          backgroundColor: isResizingBT ? '#2196f3' : 'transparent',
          transition: 'background-color 0.2s',
        }}
        title="Зажмите и перетащите для изменения ширины"
      />
    </div>
  );
};