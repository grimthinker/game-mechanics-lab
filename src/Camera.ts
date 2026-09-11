import { Point } from './types';

export class Camera {
  public scale: number = 1.5;
  public offsetX: number = 0;
  public offsetY: number = 0;
  public yaw: number = 0;
  public pitch: number = Math.PI / 3; // По умолчанию 60 градусов для 3D
  public readonly minScale: number = 0.15;
  public readonly maxScale: number = 6;

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

  public isRotating: boolean = false;
  private rotStartX: number = 0;
  private rotStartY: number = 0;

  public startRotate(clientX: number, clientY: number): void {
    this.isRotating = true;
    this.rotStartX = clientX;
    this.rotStartY = clientY;
  }

  public rotate(clientX: number, clientY: number): void {
    if (!this.isRotating) return;
    const dx = clientX - this.rotStartX;
    const dy = clientY - this.rotStartY;

    // Чувствительность вращения
    this.yaw += dx * 0.01;
    // Ограничиваем наклон (pitch), чтобы камера не уходила под землю и не переворачивалась
    this.pitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.pitch + dy * 0.01));

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
    const dx = clientX - this.panStartX;
    const dy = clientY - this.panStartY;
    this.totalPanDistance += Math.hypot(dx, dy);
    this.offsetX += dx;
    this.offsetY += dy;
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
    this.scale = 1.0;
    this.offsetX = canvas.width / 2;
    this.offsetY = canvas.height / 2;
    this.yaw = 0;
    this.pitch = Math.PI / 3;
  }
}
