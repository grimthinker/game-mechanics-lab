
import React from 'react';
import { ArmorConfig } from '../../ecs/types';

export interface ArmorEditModalProps {
  selectedArmorForEdit: ArmorConfig | null;
  isReadOnly?: boolean;
  editArmorName: string;
  setEditArmorName: (val: string) => void;
  editArmorDefense: number;
  setEditArmorDefense: (val: number) => void;
  editArmorFlatReduction: number;
  setEditArmorFlatReduction: (val: number) => void;
  editArmorWeight: number;
  setEditArmorWeight: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const ArmorEditModal: React.FC<ArmorEditModalProps> = ({
  selectedArmorForEdit,
  isReadOnly,
  editArmorName,
  setEditArmorName,
  editArmorDefense,
  setEditArmorDefense,
  editArmorFlatReduction,
  setEditArmorFlatReduction,
  editArmorWeight,
  setEditArmorWeight,
  onClose,
  onConfirm,
}) => {
  if (!selectedArmorForEdit) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Параметры брони' : 'Изменить параметры брони'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input
              disabled={isReadOnly}
              type="text"
              value={editArmorName}
              onChange={(e) => setEditArmorName(e.target.value)}
            />
          </label>
          <label>
            Защита:
            <input
              disabled={isReadOnly}
              type="number"
              value={editArmorDefense}
              min={0}
              max={100}
              onChange={(e) => setEditArmorDefense(Number(e.target.value))}
            />
          </label>
          <label>
            Поглощение урона:
            <input
              disabled={isReadOnly}
              type="number"
              value={editArmorFlatReduction}
              min={0}
              max={100}
              onChange={(e) => setEditArmorFlatReduction(Number(e.target.value))}
            />
          </label>
          <label>
            Вес:
            <input
              disabled={isReadOnly}
              type="number"
              value={editArmorWeight}
              min={0}
              max={100}
              onChange={(e) => setEditArmorWeight(Number(e.target.value))}
            />
          </label>
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {isReadOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!isReadOnly && (
            <button type="button" className="btn btn-primary" onClick={onConfirm}>
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};