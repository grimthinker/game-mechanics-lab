import { useCallback, useEffect } from 'react';
import { GameApp } from '../GameApp';
import { saveWorldToStorage } from '../storage/autoSave';
import { t } from '../locales';
import demoWorldData from '../assets/levels/demo.json';

export interface UseWorldIOOptions {
  appRef: React.MutableRefObject<GameApp | null>;
  closePieMenu: () => void;
  syncPlayerControls: () => void;
  updateStats: () => void;
}

export function useWorldIO({
  appRef,
  closePieMenu,
  syncPlayerControls,
  updateStats,
}: UseWorldIOOptions) {
  const saveWorldFile = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    const worldData = app.editorSnapshot ?? app.serializeWorld();
    const data = {
      ...worldData,
      camera: app.camera.serialize(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [appRef]);

  const loadWorldFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string);
          const app = appRef.current;
          if (app) {
            app.editorSnapshot = null;
            app.deserializeWorld(data);
            app.commandHistory.clear();
            saveWorldToStorage(app);
            syncPlayerControls();
            updateStats();
          }
        } catch (err) {
          console.error('[loadWorldFile] Ошибка при чтении JSON файла мира:', err);
          alert(t('app.jsonReadError'));
        }
      };
      reader.readAsText(file);
    },
    [appRef, syncPlayerControls, updateStats]
  );

  const createEmptyWorld = useCallback(
    (width: number, length: number) => {
      closePieMenu();
      const app = appRef.current;
      if (!app) return;

      app.editorSnapshot = null;
      app.initEmptyWorld(width, length);
      saveWorldToStorage(app);
      syncPlayerControls();
      updateStats();
    },
    [appRef, closePieMenu, syncPlayerControls, updateStats]
  );

  const loadDemoWorld = useCallback(() => {
    closePieMenu();
    const app = appRef.current;
    if (!app) return;

    app.editorSnapshot = null;
    app.deserializeWorld(demoWorldData);
    saveWorldToStorage(app);
    syncPlayerControls();
    updateStats();
  }, [appRef, closePieMenu, syncPlayerControls, updateStats]);

  // Автосохранение при закрытии/скрытии вкладки браузера
  useEffect(() => {
    const handleSave = () => {
      // Если мы в меню, мир выгружен, поэтому ничего не сохраняем, чтобы не затереть сейв пустотой
      if (appRef.current && appRef.current.gameMode !== 'menu') {
        saveWorldToStorage(appRef.current, appRef.current.editorSnapshot);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSave();
      }
    };

    window.addEventListener('beforeunload', handleSave);
    window.addEventListener('pagehide', handleSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleSave);
      window.removeEventListener('pagehide', handleSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appRef]);

  return {
    saveWorldFile,
    loadWorldFile,
    createEmptyWorld,
    loadDemoWorld,
  };
}
