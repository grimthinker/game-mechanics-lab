import { HitZoneType, WeaponConfig } from '../../ecs/types';
import { DEFAULT_ZONE_PARAMS, ZoneTypeParams } from '../../Weapon';

export interface WeaponModalState {
  config: WeaponConfig | null;
  zoneParamsMap: Record<HitZoneType, ZoneTypeParams>;
}

export const weaponModalState: WeaponModalState = {
  config: null,
  zoneParamsMap: {
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  },
};