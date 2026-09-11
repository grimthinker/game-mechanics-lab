import { Point } from './types';

import { CAMERA_CONFIG } from '../config/cameraConfig';

export class Camera {
  public scale: number = CAMERA_CONFIG.defaultZoom;
  public offsetX: number = 0;
  public offsetY: number = 0;
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
    const dx = (clientX - this.panStartX) * this.panSpeed;
    const dy = (clientY - this.panStartY) * this.panSpeed;
    this.totalPanDistance += Math.hypot(dx, dy);

    // Учитываем текущий угол поворота камеры, чтобы панорамирование шло по экранным осям
    const unRotDx = dx * Math.cos(-this.yaw) - dy * Math.sin(-this.yaw);
    const unRotDy = dx * Math.sin(-this.yaw) + dy * Math.cos(-this.yaw);

    this.offsetX += unRotDx;
    this.offsetY += unRotDy;
    this.panStartX = clientX;
    this.panStartY = clientY;
  }

  public endPan(): boolean {
    const wasDragging = this.totalPanDistance > 5;
    this.isPanning = false;
    return wasDragging;
  }

  public zoomAt(clientX: number, clientY: number, deltaY: number, canvas: HTMLCanvasElement): void {
    const factor = deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const rect = canvas.getBoundingClientRect();
    const screen = { x: clientX - rect.left, y: clientY - rect.top };
    const world = {
      x: (screen.x - this.offsetX) / this.scale,
      y: (screen.y - this.offsetY) / this.scale,
    };
    this.scale = newScale;
    this.offsetX = screen.x - world.x * newScale;
    this.offsetY = screen.y - world.y * newScale;
  }

  public getCanvasPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = screenX - cx;
    const dy = screenY - cy;

    // Снимаем вращение
    const unRotX = dx * Math.cos(-this.yaw) - dy * Math.sin(-this.yaw);
    const unRotY = dx * Math.sin(-this.yaw) + dy * Math.cos(-this.yaw);

    const px = unRotX + cx;
    const py = unRotY + cy;

    return {
      x: (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    };
  }

  public lookAt(worldX: number, worldY: number, canvas: HTMLCanvasElement): void {
    this.offsetX = canvas.width / 2 - worldX * this.scale;
    this.offsetY = canvas.height / 2 - worldY * this.scale;
  }

  public reset(canvas: HTMLCanvasElement): void {
    this.scale = CAMERA_CONFIG.defaultZoom;
    this.offsetX = canvas.width / 2;
    this.offsetY = canvas.height / 2;
    this.yaw = 0;
    this.pitch = CAMERA_CONFIG.defaultPitch;
  }
}
