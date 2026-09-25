import React from 'react';
import { t } from '../locales';

export interface HotkeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HotkeysModal: React.FC<HotkeysModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-dialog" style={{ maxWidth: '500px' }}>
        <h3>{t('hotkeys.title')}</h3>

        <div style={{ marginTop: '12px' }}>
          <h4 style={{ color: '#bdc3c7', marginBottom: '8px' }}>{t('hotkeys.globalSection')}</h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> {t('hotkeys.ctrlZY')}
            </li>
            <li>
              <kbd>U</kbd> {t('hotkeys.keyU')}
            </li>
            <li>
              <kbd>Space</kbd> {t('hotkeys.spacePause')}
            </li>
          </ul>

          <h4 style={{ color: '#bdc3c7', marginTop: '16px', marginBottom: '8px' }}>
            {t('hotkeys.gizmoSection')}
          </h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>RMB</kbd> {t('hotkeys.rmbPie')}
            </li>
            <li>
              <kbd>Q</kbd> / <kbd>W</kbd> / <kbd>E</kbd> {t('hotkeys.qweModes')}
            </li>
            <li>
              <kbd>Shift</kbd> {t('hotkeys.shiftSnap')}
            </li>
            <li>
              <kbd>Ctrl+P</kbd> {t('hotkeys.ctrlP')}
            </li>
            <li>
              <kbd>Ctrl+B</kbd> {t('hotkeys.ctrlB')}
            </li>
            <li>
              <kbd>Ctrl+I</kbd> {t('hotkeys.ctrlI')}
            </li>
            <li>
              <kbd>Delete</kbd> {t('hotkeys.deleteKey')}
            </li>
          </ul>

          <h4 style={{ color: '#bdc3c7', marginTop: '16px', marginBottom: '8px' }}>
            {t('hotkeys.gameSection')}
          </h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>W / A / S / D</kbd> {t('hotkeys.wasdMove')}
            </li>
            <li>
              <kbd>Mouse</kbd> {t('hotkeys.mouseAim')}
            </li>
            <li>
              <kbd>Space</kbd> {t('hotkeys.spaceJump')}
            </li>
            <li>
              <kbd>F</kbd> / <kbd>G</kbd> {t('hotkeys.fAttack')} (Правая / Левая рука)
            </li>
            <li>
              <kbd>1</kbd> .. <kbd>5</kbd> Меню соответствующего слота взаимодействия
            </li>
            <li>
              <kbd>Q</kbd> / <kbd>R</kbd> / <kbd>T</kbd> В меню слота: Кинуть / Выбросить / Описание
            </li>
            <li>
              <kbd>LCtrl + LMB</kbd> {t('hotkeys.ctrlLmbPickup')}
            </li>
            <li>
              <kbd>LShift</kbd> {t('hotkeys.lShiftSprint')}
            </li>
            <li>
              <kbd>X</kbd> {t('hotkeys.keyXWalk')}
            </li>
            <li>
              <kbd>C</kbd> {t('hotkeys.keyCCrouch')}
            </li>
            <li>
              <kbd>V</kbd> {t('hotkeys.keyVProne')}
            </li>
          </ul>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
