export const EDITOR_CONFIG = {
  historyMaxDepth: 50,
  cloneOffset: { x: 1.0, y: 1.0 },
  marqueeThresholdPx: 5,
  inspectorDebounceMs: 400,
  pieMenuMargin: 135,
  gridSnapSize: 0.5,
  angleSnapStep: Math.PI / 12, // 15 degrees
} as const;
