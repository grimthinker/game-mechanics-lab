import React from 'react';

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
        <h3>Горячие клавиши</h3>

        <div style={{ marginTop: '12px' }}>
          <h4 style={{ color: '#bdc3c7', marginBottom: '8px' }}>Глобальные:</h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> Отмена / Повтор действия
            </li>
            <li>
              <kbd>U</kbd> Открыть/Скрыть Дерево поведения (BT)
            </li>
            <li>
              <kbd>Пробел</kbd> Пауза / Возобновление (в режиме Симуляции)
            </li>
          </ul>

          <h4 style={{ color: '#bdc3c7', marginTop: '16px', marginBottom: '8px' }}>
            Манипуляторы и спавн (в Редакторе):
          </h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>ПКМ</kbd> Контекстное радиальное меню (Pie Menu)
            </li>
            <li>
              <kbd>Q</kbd> / <kbd>W</kbd> / <kbd>E</kbd> Режимы: Выбор / Сдвиг / Поворот
            </li>
            <li>
              <kbd>Shift</kbd> (при драге манипулятора) Сетка 10 px / Шаг угла 15°
            </li>
            <li>
              <kbd>Ctrl+P</kbd> Быстрый спавн игрока
            </li>
            <li>
              <kbd>Ctrl+B</kbd> Быстрый спавн бота
            </li>
            <li>
              <kbd>Ctrl+I</kbd> Добавить предмет
            </li>
            <li>
              <kbd>Delete</kbd> Удалить выделенные объекты
            </li>
          </ul>

          <h4 style={{ color: '#bdc3c7', marginTop: '16px', marginBottom: '8px' }}>
            Управление в игре:
          </h4>
          <ul
            className="control-keys"
            style={{ paddingLeft: '20px', margin: 0, color: '#ecf0f1', lineHeight: '1.8' }}
          >
            <li>
              <kbd>W</kbd> / <kbd>S</kbd> Движение вперед / назад
            </li>
            <li>
              <kbd>A</kbd> / <kbd>D</kbd> Стрейф влево / вправо
            </li>
            <li>
              <kbd>Мышь</kbd> Направление взгляда / прицеливание
            </li>
            <li>
              <kbd>Пробел</kbd> Атака оружием
            </li>
            <li>
              <kbd>LCtrl</kbd> + <kbd>ЛКМ</kbd> Подобрать предмет
            </li>
            <li>
              <kbd>LShift</kbd> Спринт (удержание)
            </li>
            <li>
              <kbd>X</kbd> Шаг (переключатель)
            </li>
            <li>
              <kbd>C</kbd> Присед (удержание)
            </li>
          </ul>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
