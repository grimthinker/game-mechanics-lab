/**
 * Глобальная конфигурация цветов интерфейса (HUD):
 * стили ретро-панелей, компаса, миникарты, куклы анатомии, статусных полосок и Canvas HUD.
 */
export const HUD_CONFIG = {
  // Цветовая палитра ретро-окон и рамок Win95/Fallout style
  retro: {
    bgPanel: '#8c8c8c',
    bgPanelDark: '#727272',
    borderDark: '#141414',
    borderMedium: '#383838',
    borderLight: '#dedede',
    sunkenBg: '#757575',
    sunkenBorderTopLeft: '#303030',
    textDark: '#080808',
    textMuted: '#3e3e3e',
    headerBg: '#383838',
    headerText: '#ffffff',
    accent: '#2980b9',
  },

  // Блок Е: Имя, статусные полосы и кукла анатомии
  status: {
    playerNameText: '#111111',
    bars: {
      health: '#ff2222',
      stamina: '#00e600',
      energy: '#bf55ec',
      resilience: '#00e5ff',
      balance: '#ff9900',
      barBg: '#444444',
      barText: '#ffffff',
    },
    paperDoll: {
      circleBg: '#6c6c6c',
      outline: '#222222',
      hoverStroke: '#ffffff',
      textEmpty: '#333333',
      badgeBg: 'rgba(20, 20, 20, 0.92)',
      badgeText: '#ffffff',
      badgeBorder: '#222222',
      fpIntact: '#00e600',
      fpMedium: '#ffff00',
      fpLow: '#ff0000',
      fpDestroyed: '#000000',
    },
  },

  // Блок Б: Слоты взаимодействия и области экипировки
  equipment: {
    slotEmpty: '#bfbfbf',
    slotFilled: '#d4edda',
    slotBroken: '#a94442',
    hotkeyText: '#222222',
    counterText: '#111111',
    arrowText: '#333333',
    sliderAccent: '#444444',
    contextMenu: {
      bg: '#8c8c8c',
      titleText: '#222222',
      titleBorder: '#555555',
      btnBg: '#727272',
      btnBorder: '#222222',
      btnDropText: '#080808',
      btnThrowText: '#8b0000',
    },
  },

  // Блок Ж: Компас направлений
  compass: {
    centerMarker: '#cc0000',
    majorTick: '#222222',
    minorTick: '#555555',
    mainCardinalText: '#990000',
    secondaryCardinalText: '#080808',
  },

  // Блок Д: Миникарта
  minimap: {
    bg: '#6c7772',
    textPrimary: '#1a1a1a',
    textSecondary: '#2a2a2a',
    gridDot: 'rgba(0,0,0,0.15)',
  },

  // Блоки А (Квесты) и В (Журнал)
  questsAndLog: {
    emptyText: '#2a2a2a',
  },

  // Игровое меню на паузе (GameMenuModal)
  menuModal: {
    overlayBg: 'rgba(0, 0, 0, 0.55)',
    quitBtnText: '#7a0000',
  },

  // Плашка HUD на холсте (CanvasHUD в редакторе)
  canvasHud: {
    barBg: 'rgba(20, 20, 20, 0.78)',
    barBorder: 'rgba(255, 255, 255, 0.12)',
    textNormal: '#cccccc',
    textLabel: '#888888',
    textValue: '#ffffff',
    textCamera: '#3498db',
    textCursor: '#2ecc71',
    textNone: '#666666',
    btnBg: '#2c3e50',
    btnActiveBg: '#2980b9',
    settingsPanelBg: 'rgba(24, 24, 24, 0.95)',
    settingsPanelBorder: 'rgba(255, 255, 255, 0.15)',
    settingsHeader: '#3498db',
    panAccent: '#2ecc71',
    rotateAccent: '#f39c12',
  },
};
