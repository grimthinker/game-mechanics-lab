export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}

export type CreatureType = 'player' | 'ai';

// Стандартные размеры для будущей интеграции с сеткой Pathfinder
export const STANDARD_RADII = [12, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export interface CreatureConfig {
  id: string;
  type: CreatureType;
  position: Point;
  radius: number;
  mass: number;           // Влияет на силу выталкивания при столкновении
  maxSpeed: number;       // Максимальная скорость перемещения (пикселей/сек)
  maxTurnSpeed: number;   // Максимальная скорость поворота (радианы/сек)
  maxHp?: number;         // Максимальное количество очков жизни
  hp?: number;            // Текущее количество очков жизни
}

// Интерфейс управления движением существа
export interface IMovable {
  startMovingForward(): void;
  stopMovingForward(): void;
  startTurning(direction: -1 | 1): void; // -1: влево, 1: вправо
  stopTurning(): void;
}