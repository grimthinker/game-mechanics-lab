import React from 'react';
import { t } from '../locales';

export interface MainMenuProps {
  onOpenEditor: () => void;
  onDemoLevel?: () => void;
  onOpenSettings?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onOpenEditor,
  onDemoLevel,
  onOpenSettings,
}) => {
  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 18px',
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
    backdropFilter: 'blur(8px)',
    color: '#ecf0f1',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(41, 128, 185, 0.85)',
    border: '1px solid rgba(52, 152, 219, 0.6)',
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 150,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '320px',
          backgroundColor: 'rgba(18, 18, 18, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          padding: '28px 24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: '900',
              letterSpacing: '2px',
              color: '#3498db',
              textShadow: '0 2px 8px rgba(52, 152, 219, 0.4)',
            }}
          >
            {t('mainMenu.title')}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#888',
              letterSpacing: '1px',
              marginTop: '4px',
              textTransform: 'uppercase',
            }}
          >
            {t('mainMenu.subtitle')}
          </div>
        </div>

        {/* Кнопка 1: ДЕМО УРОВЕНЬ (пока без действия) */}
        <button
          type="button"
          style={buttonStyle}
          onClick={onDemoLevel}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(45, 45, 45, 0.95)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(28, 28, 28, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
          title={t('mainMenu.soon')}
        >
          <span>🎯</span>
          <span>{t('mainMenu.demoLevel')}</span>
        </button>

        {/* Кнопка 2: РЕДАКТОР (открывает редактор) */}
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={onOpenEditor}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2980b9';
            e.currentTarget.style.borderColor = '#5dade2';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(41, 128, 185, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(52, 152, 219, 0.6)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>🛠️</span>
          <span>{t('mainMenu.editor')}</span>
        </button>

        {/* Кнопка 3: НАСТРОЙКИ (пока без действия) */}
        <button
          type="button"
          style={buttonStyle}
          onClick={onOpenSettings}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(45, 45, 45, 0.95)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(28, 28, 28, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
          title={t('mainMenu.soon')}
        >
          <span>⚙️</span>
          <span>{t('mainMenu.settings')}</span>
        </button>
      </div>
    </div>
  );
};
