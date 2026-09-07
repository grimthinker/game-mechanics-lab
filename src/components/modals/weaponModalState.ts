import { HitZoneType } from '../../ecs/types';
import { DEFAULT_ZONE_PARAMS, ZoneTypeParams } from '../../Weapon';

export interface WeaponModalState {
  zoneParamsMap: Record<HitZoneType, ZoneTypeParams>;
}

export const weaponModalState: WeaponModalState = {
  zoneParamsMap: {
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  },
};
