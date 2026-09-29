import { GRAPHICS_CONFIG } from './graphicsConfig';
import { GRASS_CONFIG } from './grassConfig';

export interface UserSettings {
  resScale: number;
  resFilter: string;
  camFov: number;
  shadowEnabled: boolean;
  shadowMapSize: number;
  waterRes: number;
  waterDisp: number;
  waterFoam: number;
  waterFps: number;
  grassDensity: number;
}

export class SettingsManager {
  /**
   * Загружает настройки из localStorage и применяет их к активным конфигурациям движка
   */
  public static load(): void {
    const loadNum = (k: string, d: number) => {
      const v = localStorage.getItem(k);
      return v !== null ? Number(v) : d;
    };
    const loadBool = (k: string, d: boolean) => {
      const v = localStorage.getItem(k);
      return v !== null ? v === 'true' : d;
    };
    const loadStr = (k: string, d: string) => {
      const v = localStorage.getItem(k);
      return v !== null ? v : d;
    };

    // Применение загруженных настроек к глобальным рабочим объектам
    GRAPHICS_CONFIG.resolution.scale = loadNum('gfx_res_scale', GRAPHICS_CONFIG.resolution.scale);
    GRAPHICS_CONFIG.resolution.upscaleFilter = loadStr(
      'gfx_res_filter',
      GRAPHICS_CONFIG.resolution.upscaleFilter
    ) as any;
    GRAPHICS_CONFIG.camera.fov = loadNum('gfx_cam_fov', GRAPHICS_CONFIG.camera.fov);

    GRAPHICS_CONFIG.shadows.enabled = loadBool(
      'gfx_shadow_enabled',
      GRAPHICS_CONFIG.shadows.enabled
    );
    GRAPHICS_CONFIG.shadows.mapSize = loadNum(
      'gfx_shadow_mapsize',
      GRAPHICS_CONFIG.shadows.mapSize
    );

    GRAPHICS_CONFIG.water.ripples.resolution = loadNum(
      'gfx_water_res',
      GRAPHICS_CONFIG.water.ripples.resolution
    );
    GRAPHICS_CONFIG.water.ripples.displacementScale = loadNum(
      'gfx_water_disp',
      GRAPHICS_CONFIG.water.ripples.displacementScale
    );
    GRAPHICS_CONFIG.water.ripples.foamThreshold = loadNum(
      'gfx_water_foam',
      GRAPHICS_CONFIG.water.ripples.foamThreshold
    );
    GRAPHICS_CONFIG.water.ripples.simFps = loadNum(
      'gfx_water_fps',
      GRAPHICS_CONFIG.water.ripples.simFps
    );

    GRASS_CONFIG.defaultDensityFactor = loadNum(
      'gfx_grass_density',
      GRASS_CONFIG.defaultDensityFactor
    );
  }

  /**
   * Сохраняет пользовательские настройки в хранилище и обновляет конфиги в памяти
   */
  public static save(settings: UserSettings): void {
    localStorage.setItem('gfx_res_scale', settings.resScale.toString());
    localStorage.setItem('gfx_res_filter', settings.resFilter);
    localStorage.setItem('gfx_cam_fov', settings.camFov.toString());
    localStorage.setItem('gfx_shadow_enabled', settings.shadowEnabled.toString());
    localStorage.setItem('gfx_shadow_mapsize', settings.shadowMapSize.toString());
    localStorage.setItem('gfx_water_res', settings.waterRes.toString());
    localStorage.setItem('gfx_water_disp', settings.waterDisp.toString());
    localStorage.setItem('gfx_water_foam', settings.waterFoam.toString());
    localStorage.setItem('gfx_water_fps', settings.waterFps.toString());
    localStorage.setItem('gfx_grass_density', settings.grassDensity.toString());

    // Синхронизация с рабочей памятью
    GRAPHICS_CONFIG.resolution.scale = settings.resScale;
    GRAPHICS_CONFIG.resolution.upscaleFilter = settings.resFilter as any;
    GRAPHICS_CONFIG.camera.fov = settings.camFov;
    GRAPHICS_CONFIG.shadows.enabled = settings.shadowEnabled;
    GRAPHICS_CONFIG.shadows.mapSize = settings.shadowMapSize;
    GRAPHICS_CONFIG.water.ripples.resolution = settings.waterRes;
    GRAPHICS_CONFIG.water.ripples.displacementScale = settings.waterDisp;
    GRAPHICS_CONFIG.water.ripples.foamThreshold = settings.waterFoam;
    GRAPHICS_CONFIG.water.ripples.simFps = settings.waterFps;
    GRASS_CONFIG.defaultDensityFactor = settings.grassDensity;
  }
}
