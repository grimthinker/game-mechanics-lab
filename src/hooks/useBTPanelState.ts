import { useState, useEffect } from 'react';

export function useBTPanelState() {
  const [showBTPanel, setShowBTPanel] = useState<boolean>(() => {
    const saved = localStorage.getItem('showBTPanel');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [btPanelWidth, setBtPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('btPanelWidth');
    return saved !== null ? Number(saved) : 560;
  });
  const [isResizingBT, setIsResizingBT] = useState<boolean>(false);

  const [blackboardHeight, setBlackboardHeight] = useState<number>(() => {
    const saved = localStorage.getItem('blackboardHeight');
    return saved !== null ? Number(saved) : 280;
  });
  const [isResizingBB, setIsResizingBB] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('showBTPanel', JSON.stringify(showBTPanel));
  }, [showBTPanel]);

  useEffect(() => {
    localStorage.setItem('btPanelWidth', btPanelWidth.toString());
  }, [btPanelWidth]);

  useEffect(() => {
    localStorage.setItem('blackboardHeight', blackboardHeight.toString());
  }, [blackboardHeight]);

  useEffect(() => {
    const handleMouseMoveResize = (e: MouseEvent) => {
      if (!isResizingBT) return;
      const newWidth = Math.max(350, Math.min(window.innerWidth - 300, e.clientX));
      setBtPanelWidth(newWidth);
    };

    const handleMouseUpResize = () => {
      setIsResizingBT(false);
    };

    if (isResizingBT) {
      window.addEventListener('mousemove', handleMouseMoveResize);
      window.addEventListener('mouseup', handleMouseUpResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveResize);
      window.removeEventListener('mouseup', handleMouseUpResize);
    };
  }, [isResizingBT]);

  useEffect(() => {
    const handleMouseMoveBBResize = (e: MouseEvent) => {
      if (!isResizingBB) return;
      const newHeight = Math.max(120, Math.min(window.innerHeight - 150, window.innerHeight - e.clientY));
      setBlackboardHeight(newHeight);
    };

    const handleMouseUpBBResize = () => {
      setIsResizingBB(false);
    };

    if (isResizingBB) {
      window.addEventListener('mousemove', handleMouseMoveBBResize);
      window.addEventListener('mouseup', handleMouseUpBBResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveBBResize);
      window.removeEventListener('mouseup', handleMouseUpBBResize);
    };
  }, [isResizingBB]);

  return {
    showBTPanel,
    setShowBTPanel,
    btPanelWidth,
    isResizingBT,
    setIsResizingBT,
    blackboardHeight,
    isResizingBB,
    setIsResizingBB,
  };
}