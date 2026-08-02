import { Point } from "./types";


export function vec2_distance_to(start: Point, end: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function now_with_ms() {
    return Date.now() / 1000;
}