import React from 'react';
import {
  STANDARD_RADII,
  StandardRadius,
} from '../../ecs/types';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';

export interface SpawnModalProps {
  isOpen: boolean;
  pendingSpawnBehavior: string;
  setPendingSpawnBehavior: (behavior: string) => void;
  isSolid: boolean;
  setIsSolid: (val: boolean) => void;
  radius: number;
  setRadius: (val: StandardRadius) => void;
  weight: number;
  setWeight: (val: number) => void;
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
  stealthPower: number;
  setStealthPower: (val: number) => void;
  runStealthMultiplier: number;
  setRunStealthMultiplier: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const SpawnModal: React.FC<SpawnModalProps> = ({
  isOpen,
  pendingSpawnBehavior,
  setPendingSpawnBehavior,
  isSolid,
  setIsSolid,
  radius,
  setRadius,
  weight,
  setWeight,
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
  stealthPower,
  setStealthPower,
  runStealthMultiplier,
  setRunStealthMultiplier,
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
            Поведение:
            <select
              value={pendingSpawnBehavior}
              onChange={(e) => setPendingSpawnBehavior(e.target.value)}
            >
              {Object.entries(BEHAVIOR_TREE_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '8px 0' }}>
            <input type="checkbox" checked={isSolid} onChange={(e) => setIsSolid(e.target.checked)} />
            Участвует в коллизии
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
              value={weight}
              min={1}
              max={100}
              onChange={(e) => setWeight(Number(e.target.value))}
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
            Скрытность (Stealth Power):
            <input
              type="number"
              value={stealthPower}
              min={0}
              max={1000}
              step={1}
              onChange={(e) => setStealthPower(Number(e.target.value))}
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
            Множитель скрытности при беге:
            <input
              type="number"
              value={runStealthMultiplier}
              min={0}
              max={10}
              step={0.1}
              onChange={(e) => setRunStealthMultiplier(Number(e.target.value))}
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