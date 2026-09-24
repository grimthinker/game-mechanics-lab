export type BehaviorTreeId = string;
export type MobTypeId = string;

export const LOGIC_CONFIG = {
  minPathRequestInterval: 0.5,

  detectDist: 25,
  loseTargetDist: 35,
  followUpDist: 3.0,
  followStopDist: 2.0,
  /**Расстояние, на котором точка считается достигнутой */
  inPosDist: 0.5,
  /**Угол (в радианах) до целевого значения, в пределах которого считается, что бот смотрит на цель и его не надо доворачивать дальше */
  angleDiffTolerance: 0.05,
  /**Угловой допуск для броска предмета (15 градусов в радианах) */
  throwTurnTolerance: Math.PI / 12,
  /**Минимальный угол, с которого начинается замедление пповорачивания */
  slowDownAngle: Math.PI / 4,
  /**Минимальная скорость поворота */
  minRotationSpeed: 0.1,

  /**Интервал обновления текущих значений параметров */
  syncStatsInterval: 0.5,
  /**Интервал поиска новой цели */
  findNewTargetInterval: 1.2,

  /**Дефолтные параметры для апдейтера пути */
  pathUpdaterParams: {
    /**Минимальный интервал между обновлением пути */
    minIntervalDt: 0.2,
    /**Максимальный интервал между обновлением пути */
    maxIntervalDt: 2.0,
    maxDistanceCalc: 5.0,
    pushedDistance: 0.5,
    minTargetMoveThreshold: 0.1,
    maxTargetMoveThreshold: 1.0,
  },
};
