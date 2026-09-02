import React from 'react';
import {
  CreatureType,
  STANDARD_RADII,
  StandardRadius,
} from '../../ecs/types';

export interface SpawnModalProps {
  isOpen: boolean;
  pendingSpawnType: CreatureType;
  setPendingSpawnType: (type: CreatureType) => void;
  radius: number;
  setRadius: (val: StandardRadius) => void;
  mass: number;
  setMass: (val: number) => void;
  maxSpeed: number;
  setMaxSpeed: (val: number) => void;
  maxTurnSpeed: number;
  setMaxTurnSpeed: (val: number) => void;
  runSpeedMultiplier: number;
  setRunSpeedMultiplier: (val: number) => void;
  crouchSpeedMultiplier: number;
  setCrouchSpeedMultiplier: (val: number) => void;
  crouchStealthMultiplier: number;
  setCrouchStealthMultiplier: (val: number) => void;
  runTurnMultiplier: number;
  setRunTurnMultiplier: (val: number) => void;
  crouchTurnMultiplier: number;
  setCrouchTurnMultiplier: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const SpawnModal: React.FC<SpawnModalProps> = ({
  isOpen,
  pendingSpawnType,
  setPendingSpawnType,
  radius,
  setRadius,
  mass,
  setMass,
  maxSpeed,
  setMaxSpeed,
  maxTurnSpeed,
  setMaxTurnSpeed,
  runSpeedMultiplier,
  setRunSpeedMultiplier,
  crouchSpeedMultiplier,
  setCrouchSpeedMultiplier,
  crouchStealthMultiplier,
  setCrouchStealthMultiplier,
  runTurnMultiplier,
  setRunTurnMultiplier,
  crouchTurnMultiplier,
  setCrouchTurnMultiplier,
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
        <h3>Параметры нового существа</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Тип существа:
            <select
              value={pendingSpawnType}
              onChange={(e) => setPendingSpawnType(e.target.value as CreatureType)}
            >
              <option value="player">Игрок</option>
              <option value="ai">Бот</option>
            </select>
          </label>
          <label>
            Радиус:
            <select
              value={radius}
              onChange={(e) => {
                const val = Number(e.target.value);
                if ((STANDARD_RADII as readonly number[]).includes(val)) {
                  setRadius(val as StandardRadius);
                }
              }}
            >
              {STANDARD_RADII.map((r) => (
                <option key={r} value={r}>
                  {r} px
                </option>
              ))}
            </select>
          </label>
          <label>
            Масса:
            <input
              type="number"
              value={mass}
              min={1}
              max={100}
              onChange={(e) => setMass(Number(e.target.value))}
            />
          </label>
          <label>
            Макс. скорость:
            <input
              type="number"
              value={maxSpeed}
              min={0}
              max={1000}
              step={10}
              onChange={(e) => setMaxSpeed(Number(e.target.value))}
            />
          </label>
          <label>
            Макс. скорость поворота (°/с):
            <input
              type="number"
              value={maxTurnSpeed}
              min={0}
              max={1080}
              step={10}
              onChange={(e) => setMaxTurnSpeed(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости бега:
            <input
              type="number"
              value={runSpeedMultiplier}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(e) => setRunSpeedMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости присяда:
            <input
              type="number"
              value={crouchSpeedMultiplier}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(e) => setCrouchSpeedMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скрытности присяда:
            <input
              type="number"
              value={crouchStealthMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setCrouchStealthMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости поворота при беге:
            <input
              type="number"
              value={runTurnMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setRunTurnMultiplier(Number(e.target.value))}
            />
          </label>
          <label>
            Множитель скорости поворота в присяди:
            <input
              type="number"
              value={crouchTurnMultiplier}
              min={1}
              max={10}
              step={0.1}
              onChange={(e) => setCrouchTurnMultiplier(Number(e.target.value))}
            />
          </label>
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Выбрать место
          </button>
        </div>
      </div>
    </div>
  );
};