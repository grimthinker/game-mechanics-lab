export type WaterBodyType = 'lake' | 'river';

export interface WaterComponent {
  /** Ширина водной глади по оси X (в метрах) */
  width: number;
  /** Длина водной глади по оси Z (в метрах) */
  depth: number;
  /** Вертикальная глубина водоема вниз от поверхности (в метрах) */
  maxDepth: number;
  /** Тип водоема: стоячее озеро или река с течением */
  waterType: WaterBodyType;
  /** Цвет воды у берега / на мелководье (Hex / CSS) */
  color: string;
  /** Цвет воды на глубине / в омуте (Hex / CSS) */
  deepColor: string;
  /** Непрозрачность воды на глубине (от 0.0 до 1.0) */
  opacity: number;
  /** Прозрачность воды у самой кромки берега (от 0.0 до 1.0) */
  shallowOpacity: number;
  /** Дистанция прозрачности в метрах (на какой глубине вода становится полностью темной) */
  clarity: number;
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
  maxDepth?: number;
  waterType?: WaterBodyType;
  color?: string;
  deepColor?: string;
  opacity?: number;
  shallowOpacity?: number;
  clarity?: number;
  waveSpeed?: number;
  waveHeight?: number;
  flowDirection?: { x: number; z: number };
  flowSpeed?: number;
  density?: number;
  viscosity?: number;
}
