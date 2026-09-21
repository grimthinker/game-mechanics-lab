import { Vec3 } from '../types';

export function vec3(x: number = 0, y: number = 0, z: number = 0): Vec3 {
  return { x, y, z };
}

export function vec3_clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function vec3_set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function vec3_add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3_sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3_scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3_len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function vec3_distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Расстояние в горизонтальной плоскости XZ (по полу) */
export function vec3_distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function vec3_normalize(v: Vec3): Vec3 {
  const l = vec3_len(v);
  if (l < 0.00001) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
