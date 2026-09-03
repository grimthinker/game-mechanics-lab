import React from 'react';
import { STANDARD_RADII, StandardRadius } from '../../ecs/types';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';

export interface CreatureEditModalProps {
  isOpen: boolean;
  isReadOnly?: boolean;
  editBehavior: string;
  setEditBehavior: (val: string) => void;
  editRadius: number;
  setEditRadius: (val: StandardRadius) => void;
  editBaseRadius: number;
  setEditBaseRadius: (val: StandardRadius) => void;
  editHp: number;
  setEditHp: (val: number) => void;
  editMaxHp: number;
  setEditMaxHp: (val: number) => void;
  editMaxSpeed: number;
  setEditMaxSpeed: (val: number) => void;
  editMaxTurnSpeed: number;
  setEditMaxTurnSpeed: (val: number) => void;
  editRunSpeedMultiplier: number;
  setEditRunSpeedMultiplier: (val: number) => void;
  editCrouchSpeedMultiplier: number;
  setEditCrouchSpeedMultiplier: (val: number) => void;
  editCrouchStealthMultiplier: number;
  setEditCrouchStealthMultiplier: (val: number) => void;
  editRunTurnMultiplier: number;
  setEditRunTurnMultiplier: (val: number) => void;
  editCrouchTurnMultiplier: number;
  setEditCrouchTurnMultiplier: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const CreatureEditModal: React.FC<CreatureEditModalProps> = ({
  isOpen,
  isReadOnly,
  editBehavior,
  setEditBehavior,
  editRadius,
  setEditRadius,
  editBaseRadius,
  setEditBaseRadius,
  editHp,
  setEditHp,
  editMaxHp,
  setEditMaxHp,
  editMaxSpeed,
  setEditMaxSpeed,
  editMaxTurnSpeed,
  setEditMaxTurnSpeed,
  editRunSpeedMultiplier,
  setEditRunSpeedMultiplier,
  editCrouchSpeedMultiplier,
  setEditCrouchSpeedMultiplier,
  editCrouchStealthMultiplier,
  setEditCrouchStealthMultiplier,
  editRunTurnMultiplier,
  setEditRunTurnMultiplier,
  editCrouchTurnMultiplier,
  setEditCrouchTurnMultiplier,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Параметры существа' : 'Изменить параметры существа'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Поведение:
            <select
              disabled={isReadOnly}
              value={editBehavior}
              onChange={(e) => setEditBehavior(e.target.value)}
            >
              {Object.entries(BEHAVIOR_TREE_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>

          {/* Текущий радиус существа (применяется к коллизии физического тела) */}
          <label>
            Текущий радиус:
            <select
              disabled={isReadOnly}
              value={editRadius}
              onChange={(e) => setEditRadius(Number(e.target.value) as StandardRadius)}
            >
              {STANDARD_RADII.map((r) => (
                <option key={r} value={r}>
                  {r} px
                </option>
              ))}
            </select>
          </label>

          {/* Базовый/дефолтный радиус существа */}
          <label>
            Базовый радиус:
            <select
              disabled={isReadOnly}
              value={editBaseRadius}
              onChange={(e) => setEditBaseRadius(Number(e.target.value) as StandardRadius)}
            >
              {STANDARD_RADII.map((r) => (
                <option key={r} value={r}>
                  {r} px
                </option>
              ))}
            </select>
          </label>

          <label>
            Текущее HP:
            <input
              disabled={isReadOnly}
              type="number"
              value={editHp}
              min={0}
              max={editMaxHp}
              onChange={(e) => setEditHp(Number(e.target.value))}
            />
          </label>
          <label>
            Макс. HP:
            <input
              disabled={isReadOnly}
              type="number"
              value={editMaxHp}
              min={1}
              max={10000}
              onChange={(e) => setEditMaxHp(Number(e.target.value))}
            />
          </label>
          <label>
            Макс. скорость:
            <input
              disabled={isReadOnly}
              type="number"
              value={editMaxSpeed}
              min={0}
              max={1000}
              step={10}
              onChange={(e) => setEditMaxSpeed(Number(e.target.value))}
            />
          </label>
          <label>
            Макс. скорость поворота (°/с):
            <input
              disabled={isReadOnly}
              type="number"
              value={editMaxTurnSpeed}
              min={0}
              max={1080}
              step={10}
              onChange={(e) => setEditMaxTurnSpeed(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости бега:
            <input
              disabled={isReadOnly}
              type="number"
              value={editRunSpeedMultiplier}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(e) => setEditRunSpeedMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости присяда:
            <input
              disabled={isReadOnly}
              type="number"
              value={editCrouchSpeedMultiplier}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(e) => setEditCrouchSpeedMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скрытности присяда:
            <input
              disabled={isReadOnly}
              type="number"
              value={editCrouchStealthMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setEditCrouchStealthMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости поворота при беге:
            <input
              disabled={isReadOnly}
              type="number"
              value={editRunTurnMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setEditRunTurnMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости поворота в присяди:
            <input
              disabled={isReadOnly}
              type="number"
              value={editCrouchTurnMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setEditCrouchTurnMultiplier(Number(e.target.value))}
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