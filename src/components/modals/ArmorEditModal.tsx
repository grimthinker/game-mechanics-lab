import React from 'react';
import { ArmorConfig } from '../../ecs/types';
import { ArmorFormFields, ArmorFormValues } from './forms/FormFields';

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

  const values: ArmorFormValues = {
    name: editArmorName,
    weight: editArmorWeight,
    defense: editArmorDefense,
    flatReduction: editArmorFlatReduction,
  };

  const handleChange = (v: Partial<ArmorFormValues>) => {
    if (v.name !== undefined) setEditArmorName(v.name);
    if (v.weight !== undefined) setEditArmorWeight(v.weight);
    if (v.defense !== undefined) setEditArmorDefense(v.defense);
    if (v.flatReduction !== undefined) setEditArmorFlatReduction(v.flatReduction);
  };

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
          <ArmorFormFields values={values} onChange={handleChange} isReadOnly={isReadOnly} />
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