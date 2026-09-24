import { Point } from './types';

export type Radians = number;
export type Degrees = number;

export function deg2Rad(deg: number): Radians {
  return ((deg * Math.PI) / 180) as Radians;
}

export function rad2Deg(rad: Radians | number): Degrees {
  return ((rad * 180) / Math.PI) as Degrees;
}

/** Вычисляет расстояние на горизонтальной плоскости пола XZ между двумя 3D-точками */
export function distanceXZ(start: { x: number; z: number }, end: { x: number; z: number }): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.hypot(dx, dz);
}

/** Сохраняем имя для обратной совместимости, фиксируя расчет строго на плоскости XZ */
export function vec2_distance_to(
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  return distanceXZ(start, end);
}

/** Вычисляет полное 3D евклидово расстояние в пространстве */
export function distance3D(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number }
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  return Math.hypot(dx, dy, dz);
}

export function nowInSeconds(): number {
  return Date.now() / 1000;
}

export function createRectanglePoints(width: number, height: number): Point[] {
  const hw = width / 2;
  const hh = height / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}

export function isConvexPolygon(points: Point[]): boolean {
  const n = points.length;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const crossProduct = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(crossProduct) > 1e-7) {
      const currentSign = crossProduct > 0 ? 1 : -1;
      if (sign === 0) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
  }
  return sign !== 0;
}

export function calculateBoundingRadius(points: Point[]): number {
  let maxSq = 0;
  for (const p of points) {
    const distSq = p.x * p.x + p.y * p.y;
    if (distSq > maxSq) maxSq = distSq;
  }
  return Math.sqrt(maxSq);
}
