export const CAMERA_CONFIG = {
  defaultZoom: 1.5,
  minScale: 0.15,
  maxScale: 6.0,

  // Скорости по умолчанию
  defaultPanSpeed: 1.0,
  defaultRotateSpeed: 1.0,

  // Чувствительность мыши и ограничения обзора в 3D
  rotationSensitivity: 0.01,
  defaultPitch: Math.PI / 3, // 60 градусов
  minPitch: 0.1,
  maxPitchOffset: 0.05, // отступ от PI / 2, чтобы камера не переворачивалась
};
