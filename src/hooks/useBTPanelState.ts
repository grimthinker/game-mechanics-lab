import { useState, useEffect } from 'react';
import { useResizable } from './useResizable';

export function useBTPanelState() {
  // Панель по умолчанию всегда закрыта при старте приложения
  const [showBTPanel, setShowBTPanel] = useState<boolean>(false);

  // Унифицированный ресайз с ограничением максимальной ширины
  const {
    size: btPanelWidth,
    isResizing: isResizingBT,
    startResizing: startResizingBT,
  } = useResizable({
    storageKey: 'btPanelWidth',
    initialSize: 520,
    minSize: 320,
    maxSize: () => Math.max(320, Math.min(800, window.innerWidth - 550)),
    direction: 'horizontal',
  });

  return {
    showBTPanel,
    setShowBTPanel,
    btPanelWidth,
    isResizingBT,
    startResizingBT,
  };
}
