import { GameApp } from '../GameApp';
import { CameraState } from '../Camera';
import { SerializedWorldData } from '../ecs/WorldSerializer';

export interface AutoSaveData {
  version: number;
  timestamp: number;
  world: SerializedWorldData;
  camera: CameraState;
}

export const AUTOSAVE_STORAGE_KEY = 'game_world_autosave_v2';

export function saveWorldToStorage(
  app: GameApp,
  editorSnapshot?: SerializedWorldData | null
): boolean {
  try {
    const worldData = editorSnapshot ?? app.serializeWorld();
    const cameraData = app.camera.serialize();
    const payload: AutoSaveData = {
      version: 2,
      timestamp: Date.now(),
      world: worldData,
      camera: cameraData,
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[AutoSave] Не удалось сохранить состояние в localStorage:', err);
    return false;
  }
}

export function loadWorldFromStorage(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== 2 || !data.world) return null;
    return data as AutoSaveData;
  } catch (err) {
    console.warn('[AutoSave] Не удалось загрузить состояние из localStorage:', err);
    return null;
  }
}
