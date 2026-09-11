import { Camera } from '../Camera';
import { rad2Deg } from '../utils';
import { GizmoRenderData } from './types';

export class GizmoRenderer {
  public static render(ctx: CanvasRenderingContext2D, camera: Camera, data: GizmoRenderData): void {
    const {
      tool,
      position,
      angle,
      hoveredHandle,
      activeHandle,
      isDragging,
      dragDelta,
      dragDeltaAngle,
    } = data;
    const invScale = 1 / camera.scale;

    const px = position.x;
    const py = position.y;

    ctx.save();

    if (tool === 'translate') {
      this.renderTranslate(
        ctx,
        invScale,
        px,
        py,
        hoveredHandle,
        activeHandle,
        isDragging,
        dragDelta
      );
    } else if (tool === 'rotate') {
      this.renderRotate(
        ctx,
        invScale,
        px,
        py,
        angle,
        hoveredHandle,
        activeHandle,
        isDragging,
        dragDeltaAngle,
        data.initialAngle
      );
    }

    ctx.restore();
  }

  private static renderTranslate(
    ctx: CanvasRenderingContext2D,
    invScale: number,
    px: number,
    py: number,
    hovered: string | null,
    active: string | null,
    isDragging: boolean,
    dragDelta?: { x: number; y: number }
  ): void {
    const axisLen = 65 * invScale;
    const arrowHeadLen = 13 * invScale;
    const arrowHeadHalfW = 6 * invScale;
    const centerBoxSize = 14 * invScale;
    const lineWidth = 2.5 * invScale;

    const isHoveredCenter = hovered === 'center' || active === 'center';
    const isHoveredX = hovered === 'x' || active === 'x';
    const isHoveredY = hovered === 'y' || active === 'y';

    // 1. Отрисовка направляющих линий во время драга
    if (isDragging && (active === 'x' || active === 'y')) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5 * invScale, 4 * invScale]);
      ctx.strokeStyle = active === 'x' ? 'rgba(231, 76, 60, 0.7)' : 'rgba(46, 204, 113, 0.7)';
      ctx.lineWidth = 1.5 * invScale;

      if (active === 'x') {
        ctx.moveTo(px - 2000 * invScale, py);
        ctx.lineTo(px + 2000 * invScale, py);
      } else {
        ctx.moveTo(px, py - 2000 * invScale);
        ctx.lineTo(px, py + 2000 * invScale);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Центральный квадрат (свободное 2D перемещение)
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.rect(px - centerBoxSize / 2, py - centerBoxSize / 2, centerBoxSize, centerBoxSize);
    ctx.fillStyle = isHoveredCenter ? 'rgba(241, 196, 15, 0.7)' : 'rgba(241, 196, 15, 0.25)';
    ctx.fill();
    ctx.strokeStyle = isHoveredCenter ? '#ffffff' : '#f39c12';
    ctx.lineWidth = (isHoveredCenter ? 2.5 : 1.5) * invScale;
    ctx.stroke();

    // 3. Стрелка оси X (Красная, вправо)
    const colorX = isHoveredX ? '#ffffff' : '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(px + centerBoxSize / 2, py);
    ctx.lineTo(px + axisLen, py);
    ctx.strokeStyle = colorX;
    ctx.lineWidth = isHoveredX ? 3.5 : lineWidth;
    ctx.stroke();

    // Наконечник X
    ctx.beginPath();
    ctx.moveTo(px + axisLen + arrowHeadLen, py);
    ctx.lineTo(px + axisLen, py - arrowHeadHalfW);
    ctx.lineTo(px + axisLen, py + arrowHeadHalfW);
    ctx.closePath();
    ctx.fillStyle = colorX;
    ctx.fill();

    // Текст "X"
    ctx.font = `bold ${Math.max(10, 11 * invScale)}px sans-serif`;
    ctx.fillStyle = colorX;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', px + axisLen + arrowHeadLen + 4 * invScale, py);

    // 4. Стрелка оси Y (Зеленая, вниз)
    const colorY = isHoveredY ? '#ffffff' : '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(px, py + centerBoxSize / 2);
    ctx.lineTo(px, py + axisLen);
    ctx.strokeStyle = colorY;
    ctx.lineWidth = isHoveredY ? 3.5 : lineWidth;
    ctx.stroke();

    // Наконечник Y
    ctx.beginPath();
    ctx.moveTo(px, py + axisLen + arrowHeadLen);
    ctx.lineTo(px - arrowHeadHalfW, py + axisLen);
    ctx.lineTo(px + arrowHeadHalfW, py + axisLen);
    ctx.closePath();
    ctx.fillStyle = colorY;
    ctx.fill();

    // Текст "Y"
    ctx.font = `bold ${Math.max(10, 11 * invScale)}px sans-serif`;
    ctx.fillStyle = colorY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Y', px, py + axisLen + arrowHeadLen + 3 * invScale);

    // 5. Всплывающая плашка со смещением при перемещении
    if (isDragging && dragDelta) {
      const text = `ΔX: ${dragDelta.x > 0 ? '+' : ''}${Math.round(dragDelta.x)} px, ΔY: ${dragDelta.y > 0 ? '+' : ''}${Math.round(dragDelta.y)} px`;
      this.renderTooltipBadge(ctx, invScale, px, py - 25 * invScale, text, '#2980b9');
    }
  }

  private static renderRotate(
    ctx: CanvasRenderingContext2D,
    invScale: number,
    px: number,
    py: number,
    angle: number,
    hovered: string | null,
    active: string | null,
    isDragging: boolean,
    dragDeltaAngle?: number,
    initialAngle?: number
  ): void {
    const ringRadius = 55 * invScale;
    const isHovered = hovered === 'rotate' || active === 'rotate';
    const ringColor = isHovered ? '#ffffff' : '#3498db';

    // 1. Окружность манипулятора
    ctx.beginPath();
    ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = (isHovered ? 3.0 : 2.0) * invScale;
    ctx.stroke();

    // 2. Деления (засечки каждые 45 градусов)
    ctx.save();
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.7)' : 'rgba(52, 152, 219, 0.6)';
    ctx.lineWidth = 1.5 * invScale;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(px + cosA * (ringRadius - 4 * invScale), py + sinA * (ringRadius - 4 * invScale));
      ctx.lineTo(px + cosA * (ringRadius + 4 * invScale), py + sinA * (ringRadius + 4 * invScale));
      ctx.stroke();
    }
    ctx.restore();

    // 3. Стрелка текущего направления вращения объекта
    const needleLen = ringRadius + 8 * invScale;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(angle) * needleLen, py + Math.sin(angle) * needleLen);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2.0 * invScale;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      px + Math.cos(angle) * needleLen,
      py + Math.sin(angle) * needleLen,
      4 * invScale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#f1c40f';
    ctx.fill();

    // 4. Сектор отклонения при драге
    if (isDragging && dragDeltaAngle !== undefined) {
      const startAngle = initialAngle !== undefined ? initialAngle : angle - dragDeltaAngle;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, ringRadius, startAngle, angle, dragDeltaAngle < 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(52, 152, 219, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2 * invScale;
      ctx.stroke();
      ctx.restore();

      const degVal = Math.round(rad2Deg(angle));
      const deltaDegVal = rad2Deg(dragDeltaAngle).toFixed(1);
      const text = `${degVal}° (Δ ${dragDeltaAngle >= 0 ? '+' : ''}${deltaDegVal}°)`;
      this.renderTooltipBadge(
        ctx,
        invScale,
        px,
        py - (ringRadius + 20 * invScale),
        text,
        '#8e44ad'
      );
    }
  }

  private static renderTooltipBadge(
    ctx: CanvasRenderingContext2D,
    invScale: number,
    x: number,
    y: number,
    text: string,
    accentColor: string
  ): void {
    ctx.save();
    ctx.font = `${Math.max(10, 11 * invScale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const padX = 8 * invScale;
    const padY = 4 * invScale;
    const boxW = metrics.width + padX * 2;
    const boxH = 18 * invScale;

    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5 * invScale;

    ctx.beginPath();
    ctx.rect(x - boxW / 2, y - boxH / 2, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
