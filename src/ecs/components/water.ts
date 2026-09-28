export type WaterBodyType = 'lake' | 'river';

export interface WaterComponent {
  /** Ширина водной глади по оси X (в метрах) */
  width: number;
  /** Длина водной глади по оси Z (в метрах) */
  depth: number;
  /** Тип водоема: стоячее озеро или река с течением */
  waterType: WaterBodyType;
  /** Цвет воды (Hex / CSS) */
  color: string;
  /** Прозрачность (от 0.0 до 1.0) */
  opacity: number;
  /** Скорость анимации волн */
  waveSpeed: number;
  /** Высота (амплитуда) волн в метрах */
  waveHeight: number;
  /** Направление вектора течения в плоскости XZ */
  flowDirection: { x: number; z: number };
  /** Скорость поверхностного течения (м/с) */
  flowSpeed: number;
  /** Плотность среды (кг/м³, по умолчанию 1000 для пресной воды) */
  density: number;
  /** Коэффициент вязкого сопротивления среды */
  viscosity: number;
}

export interface WaterConfig {
  width?: number;
  depth?: number;
  waterType?: WaterBodyType;
  color?: string;
  opacity?: number;
  waveSpeed?: number;
  waveHeight?: number;
  flowDirection?: { x: number; z: number };
  flowSpeed?: number;
  density?: number;
  viscosity?: number;
}
