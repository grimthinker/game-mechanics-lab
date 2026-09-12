export const AI_DEBUG_CONFIG = {
  // Время удержания вспышки результата выполнения узла в BTGraph (мс)
  btFlashDurationMs: 400,

  colors: {
    // Цвета удержания вспышки в дереве (RGBA)
    btFlashSuccess: 'rgba(19, 209, 28, 0.7)',
    btFlashFailure: 'rgba(255, 3, 3, 0.7)',

    // Цвета радиусов на холсте
    detectRadius: 'rgba(241, 196, 15, 0.6)', // Желтый
    loseRadius: 'rgba(231, 76, 60, 0.5)', // Красный
    attackRadius: 'rgba(230, 126, 34, 0.7)', // Оранжевый

    // Линии пути и прицеливания
    pathLine: 'rgba(52, 152, 219, 0.8)', // Синий
    targetLine: 'rgba(231, 76, 60, 0.9)', // Ярко-красный

    // Информационный бейдж
    badgeBg: 'rgba(15, 15, 15, 0.85)',
    badgeText: '#ffffff',
  },

  dashArrays: {
    radii: [5, 5],
    path: [4, 4],
    targetLine: [8, 4],
  },
};
