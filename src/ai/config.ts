export type BehaviorTreeId = string;
export type MobTypeId = string;

export const LOGIC_CONFIG = {
  min_path_request_interval: 0.5,
  
  follow_up_dist: 50,
  follow_stop_dist: 40,
  /**Расстояние, на котором точка считается достигнутой */
  in_pos_dist: 5,
  /**Угол (в радианах) до целевого значения, в пределах которого считается, что бот смотрит на цель и его не надо доворачивать дальше */
  angleDiffTolerance: 0.05,
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
    maxDistanceCalc: 50,
    pushedDistance: 5,
    minTargetMoveThreshold: 1.0,
    maxTargetMoveThreshold: 10.0,
  }
};