import { useState, useEffect, useRef, useCallback } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical' | 'vertical-inverted';

export interface UseResizableOptions {
  storageKey: string;
  initialSize: number;
  minSize?: number;
  maxSize?: number | (() => number);
  direction: ResizeDirection;
}

export function useResizable({
  storageKey,
  initialSize,
  minSize = 100,
  maxSize = 800,
  direction,
}: UseResizableOptions) {
  const [size, setSize] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const val = saved !== null ? Number(saved) : initialSize;
    const max = typeof maxSize === 'function' ? maxSize() : maxSize;
    return Math.max(minSize, Math.min(max, val));
  });

  const [isResizing, setIsResizing] = useState<boolean>(false);
  const startCoordRef = useRef<number>(0);
  const startSizeRef = useRef<number>(size);

  useEffect(() => {
    localStorage.setItem(storageKey, size.toString());
  }, [storageKey, size]);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startCoordRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      startSizeRef.current = size;
    },
    [direction, size]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentCoord = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta =
        direction === 'vertical-inverted'
          ? startCoordRef.current - currentCoord
          : currentCoord - startCoordRef.current;

      const max = typeof maxSize === 'function' ? maxSize() : maxSize;
      const newSize = Math.max(minSize, Math.min(max, startSizeRef.current + delta));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minSize, maxSize, direction]);

  return {
    size,
    setSize,
    isResizing,
    startResizing,
  };
}
