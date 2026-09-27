import React, { useState } from 'react';
import { t } from '../../locales';

export interface NewWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (width: number, length: number) => void;
}

export const NewWorldModal: React.FC<NewWorldModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [width, setWidth] = useState(100);
  const [length, setLength] = useState(100);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(Math.min(1000, Math.max(10, width)), Math.min(1000, Math.max(10, length)));
    onClose();
  };

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog" style={{ maxWidth: '300px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#ecf0f1' }}>{t('modals.newWorldTitle')}</h3>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}
        >
          <span style={{ fontSize: '12px', color: '#bdc3c7' }}>{t('modals.worldWidth')}</span>
          <input
            type="number"
            value={width}
            min={10}
            max={1000}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#111',
              color: '#fff',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}
        >
          <span style={{ fontSize: '12px', color: '#bdc3c7' }}>{t('modals.worldLength')}</span>
          <input
            type="number"
            value={length}
            min={10}
            max={1000}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#111',
              color: '#fff',
            }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            style={{ backgroundColor: '#444', color: '#fff', padding: '8px 16px' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleConfirm}
            style={{
              backgroundColor: '#27ae60',
              color: '#fff',
              fontWeight: 'bold',
              padding: '8px 20px',
            }}
          >
            {t('modals.createBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
