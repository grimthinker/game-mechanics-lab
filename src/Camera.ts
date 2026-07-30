import { Point } from './types';

export class Camera {
  public scale: number = 1;
  public offsetX: number = 0;
  public offsetY: number = 0;
  public readonly minScale: number = 0.25;
  public readonly maxScale: number = 4;

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

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
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale,
    };
  }
}