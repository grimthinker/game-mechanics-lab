import { Point } from "./types";


export type Radians = number & { readonly __brand: 'radians' };
export type Degrees = number & { readonly __brand: 'degrees' };

export function deg2Rad(deg: number): Radians {
    return ((deg * Math.PI) / 180) as Radians;
}

export function rad2Deg(rad: Radians | number): Degrees {
    return ((rad * 180) / Math.PI) as Degrees;
}

export function vec2_distance_to(start: Point, end: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function now_with_ms() {
    return Date.now() / 1000;
}