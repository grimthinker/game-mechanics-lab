import { Quat, Radians } from '../types';

export function quat_identity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

export function quat_clone(q: Quat): Quat {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** Создает кватернион вращения вокруг вертикальной оси Y (Yaw / рыскание) */
export function quat_fromYaw(yaw: number): Quat {
  const half = yaw * 0.5;
  return {
    x: 0,
    y: Math.sin(half),
    z: 0,
    w: Math.cos(half),
  };
}

/** Извлекает угол рыскания (Yaw вокруг оси Y) из кватерниона в радианах [-PI, PI] */
export function quat_getYaw(q: Quat): Radians {
  const siny_cosp = 2 * (q.w * q.y + q.x * q.z);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(siny_cosp, cosy_cosp) as Radians;
}

/** Создает кватернион из углов Эйлера (в радианах, порядок YXZ) */
export function quat_fromEuler(pitch: number, yaw: number, roll: number): Quat {
  const c1 = Math.cos(yaw * 0.5);
  const c2 = Math.cos(pitch * 0.5);
  const c3 = Math.cos(roll * 0.5);

  const s1 = Math.sin(yaw * 0.5);
  const s2 = Math.sin(pitch * 0.5);
  const s3 = Math.sin(roll * 0.5);

  return {
    x: s2 * c1 * c3 + c2 * s1 * s3,
    y: c2 * s1 * c3 - s2 * c1 * s3,
    z: c2 * c1 * s3 - s2 * s1 * c3,
    w: c2 * c1 * c3 + s2 * s1 * s3,
  };
}
