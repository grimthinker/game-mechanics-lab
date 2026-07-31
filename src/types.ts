export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}

export type CreatureType = 'player' | 'ai';

export const STANDARD_RADII = [12, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export type CreatureState = 'idle' | 'moving' | 'running' | 'crouching' | 'attacking' | 'dead';

export type HitZoneType = 'radius' | 'angle' | 'line' | 'shrapnel' | 'forward_line' | 'offset_radius';

export interface WeaponConfig {
  id: string;
  name: string;
  prepTime: number;          // Время подготовки (сек)
  recoveryTime: number;      // Время восстановления (сек)
  prepTurnSlow: number;      // Доля замедления поворота при подготовке
  recoveryTurnSlow: number;  // Доля замедления поворота при восстановлении
  prepMoveSlow: number;      // Доля замедления передвижения при подготовке
  recoveryMoveSlow: number;  // Доля замедления передвижения при восстановлении
  baseDamage: number;        // Базовый урон
  minMultiplier: number;     // Минимальная доля урона
  maxMultiplier: number;     // Максимальная доля урона
  critChance: number;        // Шанс крита (0..1)
  critMultiplier: number;    // Критический множитель
  hitZoneType: HitZoneType;  // Тип зоны поражения
  radius?: number;           // Для радиусных зон
  angle?: number;            // Для угловых зон / дроби (в радианах)
  length?: number;           // Для линий / дистанция атаки
  rayCount?: number;         // Для шрапнели
  offsetDistance?: number;   // Для выносной сферы
}

export interface ActiveAttack {
  weapon: WeaponConfig;
  phase: 'prep' | 'recovery';
  timer: number;
  totalDuration: number;
}

export interface CreatureConfig {
  id: string;
  type: CreatureType;
  position: Point;
  radius: number;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  maxHp?: number;
  hp?: number;
  stealth?: number;
  baseStealth?: number;
  weapons?: WeaponConfig[];
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  crouchStealthMultiplier?: number;
}

export interface IMovable {
  startMovingForward(): void;
  stopMovingForward(): void;
  startTurning(direction: -1 | 1): void;
  stopTurning(): void;
  startRunning(): void;
  stopRunning(): void;
  startCrouching(): void;
  stopCrouching(): void;
}