import React from 'react';
import { WeaponConfig } from '../../ecs/types';
import { WeaponFormFields, WeaponFormValues } from './forms/FormFields';

export interface WeaponEditModalProps {
  selectedWeaponForEdit: WeaponConfig | null;
  isReadOnly?: boolean;
  editWeaponName: string;
  setEditWeaponName: (val: string) => void;
  editWeaponWeight: number;
  setEditWeaponWeight: (val: number) => void;
  editWeaponDamage: number;
  setEditWeaponDamage: (val: number) => void;
  editWeaponPrepTime: number;
  setEditWeaponPrepTime: (val: number) => void;
  editWeaponRecoveryTime: number;
  setEditWeaponRecoveryTime: (val: number) => void;
  editWeaponRange: number;
  setEditWeaponRange: (val: number) => void;
  editWeaponRadius: number;
  setEditWeaponRadius: (val: number) => void;
  editWeaponNumLines: number;
  setEditWeaponNumLines: (val: number) => void;
  editWeaponAngle: number;
  setEditWeaponAngle: (val: number) => void;
  editWeaponPierceObstacles: boolean;
  setEditWeaponPierceObstacles: (val: boolean) => void;
  editWeaponPiercePlayers: boolean;
  setEditWeaponPiercePlayers: (val: boolean) => void;
  editWeaponPierceBots: boolean;
  setEditWeaponPierceBots: (val: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const WeaponEditModal: React.FC<WeaponEditModalProps> = ({
  selectedWeaponForEdit,
  isReadOnly,
  editWeaponName,
  setEditWeaponName,
  editWeaponWeight,
  setEditWeaponWeight,
  editWeaponDamage,
  setEditWeaponDamage,
  editWeaponPrepTime,
  setEditWeaponPrepTime,
  editWeaponRecoveryTime,
  setEditWeaponRecoveryTime,
  editWeaponRange,
  setEditWeaponRange,
  editWeaponRadius,
  setEditWeaponRadius,
  editWeaponNumLines,
  setEditWeaponNumLines,
  editWeaponAngle,
  setEditWeaponAngle,
  editWeaponPierceObstacles,
  setEditWeaponPierceObstacles,
  editWeaponPiercePlayers,
  setEditWeaponPiercePlayers,
  editWeaponPierceBots,
  setEditWeaponPierceBots,
  onClose,
  onConfirm,
}) => {
  if (!selectedWeaponForEdit) return null;

  const values: WeaponFormValues = {
    name: editWeaponName,
    weight: editWeaponWeight,
    baseDamage: editWeaponDamage,
    prepTime: editWeaponPrepTime,
    recoveryTime: editWeaponRecoveryTime,
    range: editWeaponRange,
    radius: editWeaponRadius,
    numLines: editWeaponNumLines,
    angle: editWeaponAngle,
    pierceObstacles: editWeaponPierceObstacles,
    piercePlayers: editWeaponPiercePlayers,
    pierceBots: editWeaponPierceBots,
    hitZoneType: selectedWeaponForEdit.zone.hitZoneType,
  };

  const handleChange = (v: Partial<WeaponFormValues>) => {
    if (v.name !== undefined) setEditWeaponName(v.name);
    if (v.weight !== undefined) setEditWeaponWeight(v.weight);
    if (v.baseDamage !== undefined) setEditWeaponDamage(v.baseDamage);
    if (v.prepTime !== undefined) setEditWeaponPrepTime(v.prepTime);
    if (v.recoveryTime !== undefined) setEditWeaponRecoveryTime(v.recoveryTime);
    if (v.range !== undefined) setEditWeaponRange(v.range);
    if (v.radius !== undefined) setEditWeaponRadius(v.radius);
    if (v.numLines !== undefined) setEditWeaponNumLines(v.numLines);
    if (v.angle !== undefined) setEditWeaponAngle(v.angle);
    if (v.pierceObstacles !== undefined) setEditWeaponPierceObstacles(v.pierceObstacles);
    if (v.piercePlayers !== undefined) setEditWeaponPiercePlayers(v.piercePlayers);
    if (v.pierceBots !== undefined) setEditWeaponPierceBots(v.pierceBots);
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
        <h3>{isReadOnly ? 'Параметры оружия' : 'Изменить параметры оружия'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <WeaponFormFields values={values} onChange={handleChange} isReadOnly={isReadOnly} />
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