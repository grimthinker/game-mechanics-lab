import React from 'react';
import { WeaponConfig } from '../../ecs/types';

export interface WeaponEditModalProps {
  selectedWeaponForEdit: WeaponConfig | null;
  editWeaponName: string;
  setEditWeaponName: (val: string) => void;
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
  editWeaponName,
  setEditWeaponName,
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

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Изменить параметры оружия</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input
              type="text"
              value={editWeaponName}
              onChange={(e) => setEditWeaponName(e.target.value)}
            />
          </label>
          <label>
            Базовый урон:
            <input
              type="number"
              value={editWeaponDamage}
              min={0}
              max={500}
              onChange={(e) => setEditWeaponDamage(Number(e.target.value))}
            />
          </label>
          <label>
            Подготовка (сек):
            <input
              type="number"
              value={editWeaponPrepTime}
              min={0.05}
              max={5}
              step={0.05}
              onChange={(e) => setEditWeaponPrepTime(Number(e.target.value))}
            />
          </label>
          <label>
            Восстановление (сек):
            <input
              type="number"
              value={editWeaponRecoveryTime}
              min={0.05}
              max={5}
              step={0.05}
              onChange={(e) => setEditWeaponRecoveryTime(Number(e.target.value))}
            />
          </label>
          {(((selectedWeaponForEdit as any).zone.range !== undefined) ||
            ((selectedWeaponForEdit as any).zone.length !== undefined)) && (
            <label>
              Дальность / Длина:
              <input
                type="number"
                value={editWeaponRange}
                min={0}
                max={2000}
                step={10}
                onChange={(e) => setEditWeaponRange(Number(e.target.value))}
              />
            </label>
          )}
          {((selectedWeaponForEdit as any).zone.radius !== undefined) && (
            <label>
              Радиус:
              <input
                type="number"
                value={editWeaponRadius}
                min={0}
                max={500}
                step={5}
                onChange={(e) => setEditWeaponRadius(Number(e.target.value))}
              />
            </label>
          )}
          {(((selectedWeaponForEdit as any).zone.numLines !== undefined) ||
            ((selectedWeaponForEdit as any).zone.lines !== undefined) ||
            ((selectedWeaponForEdit as any).zone.rayCount !== undefined)) && (
            <label>
              Количество лучей / линий:
              <input
                type="number"
                value={editWeaponNumLines}
                min={1}
                max={50}
                step={1}
                onChange={(e) => setEditWeaponNumLines(Number(e.target.value))}
              />
            </label>
          )}
          {((selectedWeaponForEdit as any).zone.angle !== undefined) && (
            <label>
              Угол (°):
              <input
                type="number"
                value={editWeaponAngle}
                min={0}
                max={360}
                step={1}
                onChange={(e) => setEditWeaponAngle(Number(e.target.value))}
              />
            </label>
          )}
          {['line', 'forward_line', 'shrapnel'].includes(selectedWeaponForEdit.zone.hitZoneType) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editWeaponPierceObstacles}
                  onChange={(e) => setEditWeaponPierceObstacles(e.target.checked)}
                />
                Пробивать препятствия
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editWeaponPiercePlayers}
                  onChange={(e) => setEditWeaponPiercePlayers(e.target.checked)}
                />
                Пробивать игроков
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editWeaponPierceBots}
                  onChange={(e) => setEditWeaponPierceBots(e.target.checked)}
                />
                Пробивать ботов
              </label>
            </div>
          )}
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};