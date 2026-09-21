import { Point } from './types';

import { CAMERA_CONFIG } from './config/cameraConfig';

export interface CameraState {
  scale: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  yaw: number;
  pitch: number;
}

export class Camera {
  public scale: number = CAMERA_CONFIG.defaultZoom;
  public targetX: number = 0;
  public targetY: number = 0;
  public targetZ: number = 0;
  public yaw: number = 0;
  public pitch: number = CAMERA_CONFIG.defaultPitch;
  public readonly minScale: number = CAMERA_CONFIG.minScale;
  public readonly maxScale: number = CAMERA_CONFIG.maxScale;

  // Настройки чувствительности (с сохранением в localStorage)
  public panSpeed: number =
    Number(localStorage.getItem('camera_pan_speed')) || CAMERA_CONFIG.defaultPanSpeed;
  public rotateSpeed: number =
    Number(localStorage.getItem('camera_rotate_speed')) || CAMERA_CONFIG.defaultRotateSpeed;

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

  public isRotating: boolean = false;
  private rotStartX: number = 0;
  private rotStartY: number = 0;

  public setPanSpeed(val: number): void {
    this.panSpeed = val;
    localStorage.setItem('camera_pan_speed', val.toString());
  }

  public setRotateSpeed(val: number): void {
    this.rotateSpeed = val;
    localStorage.setItem('camera_rotate_speed', val.toString());
  }

  public startRotate(clientX: number, clientY: number): void {
    this.isRotating = true;
    this.rotStartX = clientX;
    this.rotStartY = clientY;
  }

  public rotate(clientX: number, clientY: number): void {
    if (!this.isRotating) return;
    const dx = clientX - this.rotStartX;
    const dy = clientY - this.rotStartY;

    this.yaw += dx * CAMERA_CONFIG.rotationSensitivity * this.rotateSpeed;
    this.pitch = Math.max(
      CAMERA_CONFIG.minPitch,
      Math.min(
        Math.PI / 2 - CAMERA_CONFIG.maxPitchOffset,
        this.pitch + dy * CAMERA_CONFIG.rotationSensitivity * this.rotateSpeed
      )
    );

    this.rotStartX = clientX;
    this.rotStartY = clientY;
  }

  public endRotate(): void {
    this.isRotating = false;
  }

  public startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.panStartX = clientX;
    this.panStartY = clientY;
    this.totalPanDistance = 0;
  }

  public pan(clientX: number, clientY: number): void {
    if (!this.isPanning) return;
    const metricFactor = (0.04 / this.scale) * this.panSpeed;
    const dx = (clientX - this.panStartX) * metricFactor;
    const dy = (clientY - this.panStartY) * metricFactor;
    this.totalPanDistance += Math.hypot(dx, dy);

    // Сдвигаем точку фокуса targetX и targetZ вдоль плоскости пола XZ с учетом угла камеры
    const unRotDx = dx * Math.cos(-this.yaw) - dy * Math.sin(-this.yaw);
    const unRotDz = dx * Math.sin(-this.yaw) + dy * Math.cos(-this.yaw);

    this.targetX -= unRotDx;
    this.targetZ -= unRotDz;
    this.panStartX = clientX;
    this.panStartY = clientY;
  }

  public endPan(): boolean {
    const wasDragging = this.totalPanDistance > 5;
    this.isPanning = false;
    return wasDragging;
  }

  public zoomAt(clientX: number, clientY: number, deltaY: number, canvas: HTMLCanvasElement): void {
    // В 3D масштабирование плавно регулирует дистанцию орбиты без рывков фокуса
    const factor = deltaY < 0 ? 1.15 : 0.85;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
  }

  public lookAt(worldX: number, worldZ: number, _canvas?: HTMLCanvasElement): void {
    this.targetX = worldX;
    this.targetZ = worldZ;
  }

  public reset(_canvas?: HTMLCanvasElement): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.scale = CAMERA_CONFIG.defaultZoom;
    this.yaw = 0;
    this.pitch = CAMERA_CONFIG.defaultPitch;
  }

  public resetZoomAndRotation(_canvas?: HTMLCanvasElement): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.scale = CAMERA_CONFIG.defaultZoom;
    this.yaw = 0;
    this.pitch = CAMERA_CONFIG.defaultPitch;
  }

  public serialize(): CameraState {
    return {
      scale: this.scale,
      targetX: this.targetX,
      targetY: this.targetY,
      targetZ: this.targetZ,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  public deserialize(data: Partial<CameraState>): void {
    if (typeof data.scale === 'number' && !Number.isNaN(data.scale)) {
      this.scale = Math.min(this.maxScale, Math.max(this.minScale, data.scale));
    }
    if (typeof data.targetX === 'number' && !Number.isNaN(data.targetX)) {
      this.targetX = data.targetX;
    }
    if (typeof data.targetY === 'number' && !Number.isNaN(data.targetY)) {
      this.targetY = data.targetY;
    }
    if (typeof data.targetZ === 'number' && !Number.isNaN(data.targetZ)) {
      this.targetZ = data.targetZ;
    }
    if (typeof data.yaw === 'number' && !Number.isNaN(data.yaw)) {
      this.yaw = data.yaw;
    }
    if (typeof data.pitch === 'number' && !Number.isNaN(data.pitch)) {
      this.pitch = Math.max(
        CAMERA_CONFIG.minPitch,
        Math.min(Math.PI / 2 - CAMERA_CONFIG.maxPitchOffset, data.pitch)
      );
    }
  }
}
