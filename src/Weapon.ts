import { HitZoneType } from './ecs/types';
import { deg2Rad, Radians } from './utils';
import { t } from './locales';

export const HIT_ZONE_LABELS: Record<HitZoneType, string> = {
  get angle() {
    return t('weapons.angle');
  },
  get radius() {
    return t('weapons.radius');
  },
  get forward_line() {
    return t('weapons.forward_line');
  },
  get shrapnel() {
    return t('weapons.shrapnel');
  },
};

export interface ZoneTypeParams {
  length: number;
  radius: number;
  angle: Radians;
  rayCount: number;
  pierceObstacles: boolean;
  pierceCreatures: boolean;
  pierceItems: boolean;
}

export const DEFAULT_ZONE_PARAMS: Record<HitZoneType, ZoneTypeParams> = {
  angle: {
    length: 100,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    pierceCreatures: false,
    pierceItems: false,
  },
  radius: {
    length: 100,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    pierceCreatures: false,
    pierceItems: false,
  },
  forward_line: {
    length: 150,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    pierceCreatures: false,
    pierceItems: false,
  },
  shrapnel: {
    length: 120,
    radius: 50,
    angle: deg2Rad(60),
    rayCount: 5,
    pierceObstacles: false,
    pierceCreatures: false,
    pierceItems: false,
  },
};
