import React from 'react';
import { BTNodeDTO } from '../../ai/core';

export interface BTNodeModalProps {
  selectedNode: BTNodeDTO | null;
  onClose: () => void;
}

export const BTNodeModal: React.FC<BTNodeModalProps> = ({
  selectedNode,
  onClose,
}) => {
  if (!selectedNode) return null;

  const hasParameters =
    selectedNode.parameters && Object.keys(selectedNode.parameters).length > 0;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{selectedNode.name}</h3>
        <p className="modal-subtitle" style={{ textTransform: 'uppercase' }}>
          Тип: {selectedNode.category}
          {selectedNode.status && ` — Статус: ${selectedNode.status}`}
        </p>

        <div style={{ margin: '12px 0', fontSize: '14px', lineHeight: '1.5' }}>
          <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '6px' }}>
            Описание:
          </h4>
          <p style={{ color: '#ecf0f1', margin: 0 }}>
            {selectedNode.description || 'Описание отсутствует.'}
          </p>
        </div>

        {selectedNode.timeToNextTick !== undefined && (
          <div style={{ margin: '12px 0', fontSize: '13px' }}>
            <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>
              ⏱️ До следующего тика: {selectedNode.timeToNextTick.toFixed(2)} с
            </span>
          </div>
        )}

        {hasParameters && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
              Параметры:
            </h4>
            <div
              style={{
                backgroundColor: '#111',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #333',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              {Object.entries(selectedNode.parameters!).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #222',
                  }}
                >
                  <span style={{ color: '#64b5f6' }}>{key}:</span>
                  <span style={{ color: '#a5d6a7' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};