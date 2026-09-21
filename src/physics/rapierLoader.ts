import RAPIER from '@dimforge/rapier3d-compat';

let initPromise: Promise<typeof RAPIER> | null = null;

/**
 * Гарантирует однократную асинхронную инициализацию WebAssembly-модуля Rapier3D.
 */
export async function initRapier(): Promise<typeof RAPIER> {
  if (!initPromise) {
    initPromise = RAPIER.init().then(() => {
      console.log('[RapierLoader] WebAssembly модуль Rapier3D успешно инициализирован.');
      return RAPIER;
    });
  }
  return initPromise;
}
