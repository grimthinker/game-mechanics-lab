import { Point } from '../types';
import { GizmoTool, GizmoHandle, GizmoDragState, GizmoInitialEntityData } from '../gizmos/types';
import { TransactionBuilder } from '../history/TransactionBuilder';
import { EDITOR_CONFIG } from '../config/editorConfig';
import type { GameApp } from '../GameApp';
import { Radians } from '../utils';

export class GizmoController {
  public tool: GizmoTool = 'translate';
  public hoveredHandle: GizmoHandle | null = null;
  public activeHandle: GizmoHandle | null = null;
  public dragState: GizmoDragState | null = null;

  private tx: TransactionBuilder | null = null;
  private pendingDragPoint: { point: Point; shiftKey: boolean } | null = null;

  constructor(private app: GameApp) {}

  public setTool(tool: GizmoTool): void {
    this.tool = tool;
  }

  public setPendingDrag(point: Point, shiftKey: boolean): void {
    this.pendingDragPoint = { point, shiftKey };
  }

  public applyPendingDrag(): void {
    if (!this.pendingDragPoint || !this.dragState) return;
    const { point, shiftKey } = this.pendingDragPoint;
    this.pendingDragPoint = null;
    this.updateDrag(point, shiftKey);
  }

  public hitTest(worldPoint: Point): GizmoHandle | null {
    const selId = this.app.selection.selectedEntityId;
    if (!selId || this.tool === 'select') return null;

    const transform = this.app.world.getComponent(selId, 'transform');
    if (!transform) return null;

    const invScale = 1 / this.app.camera.scale;
    const gx = transform.x;
    const gy = transform.y;
    const mx = worldPoint.x;
    const my = worldPoint.y;

    if (this.tool === 'translate') {
      const centerSize = 14 * invScale;
      if (Math.abs(mx - gx) <= centerSize / 2 && Math.abs(my - gy) <= centerSize / 2) {
        return 'center';
      }

      const axisLen = 65 * invScale;
      const hitTolerance = 9 * invScale;

      if (
        mx >= gx + centerSize / 2 &&
        mx <= gx + axisLen + 15 * invScale &&
        Math.abs(my - gy) <= hitTolerance
      ) {
        return 'x';
      }

      if (
        my >= gy + centerSize / 2 &&
        my <= gy + axisLen + 15 * invScale &&
        Math.abs(mx - gx) <= hitTolerance
      ) {
        return 'y';
      }
    } else if (this.tool === 'rotate') {
      const ringRadius = 55 * invScale;
      const ringThickness = 10 * invScale;
      const dist = Math.hypot(mx - gx, my - gy);
      if (Math.abs(dist - ringRadius) <= ringThickness) {
        return 'rotate';
      }
    }

    return null;
  }

  public startDrag(handle: GizmoHandle, worldPoint: Point): boolean {
    const selId = this.app.selection.selectedEntityId;
    if (!selId) return false;

    const anchorTransform = this.app.world.getComponent(selId, 'transform');
    if (!anchorTransform) return false;

    const idsToDrag = this.app.selection.selectedEntityIds.has(selId)
      ? Array.from(this.app.selection.selectedEntityIds)
      : [selId];

    this.tx = new TransactionBuilder(this.app, 'Трансформация манипулятором');
    this.tx.captureBefore(idsToDrag);

    const initialEntities = new Map<string, GizmoInitialEntityData>();

    for (const entId of idsToDrag) {
      const t = this.app.world.getComponent(entId, 'transform');
      if (t) {
        initialEntities.set(entId, {
          pos: { x: t.x, y: t.y },
          angle: t.angle,
        });
      }
    }

    const anchorPos = { x: anchorTransform.x, y: anchorTransform.y };
    const startAngle = Math.atan2(worldPoint.y - anchorPos.y, worldPoint.x - anchorPos.x);

    this.activeHandle = handle;
    this.dragState = {
      tool: this.tool,
      handle,
      startPoint: { x: worldPoint.x, y: worldPoint.y },
      currentPoint: { x: worldPoint.x, y: worldPoint.y },
      anchorPos,
      startAngle,
      currentAngle: startAngle,
      initialAnchorAngle: anchorTransform.angle,
      appliedDeltaAngle: 0,
      initialEntities,
    };

    return true;
  }

  public updateDrag(worldPoint: Point, shiftKey: boolean = false): void {
    if (!this.dragState) return;

    this.dragState.currentPoint = { x: worldPoint.x, y: worldPoint.y };

    if (this.dragState.tool === 'translate') {
      let rawDx = worldPoint.x - this.dragState.startPoint.x;
      let rawDy = worldPoint.y - this.dragState.startPoint.y;

      if (this.dragState.handle === 'x') {
        rawDy = 0;
      } else if (this.dragState.handle === 'y') {
        rawDx = 0;
      }

      if (shiftKey) {
        const snapGrid = EDITOR_CONFIG.gridSnapSize;
        rawDx = Math.round(rawDx / snapGrid) * snapGrid;
        rawDy = Math.round(rawDy / snapGrid) * snapGrid;
      }

      for (const [entId, initData] of this.dragState.initialEntities.entries()) {
        const t = this.app.world.getComponent(entId, 'transform');
        const phys = this.app.world.getComponent(entId, 'physicsBody');
        const newX = initData.pos.x + rawDx;
        const newY = initData.pos.y + rawDy;

        if (t) {
          t.x = newX;
          t.y = newY;
        }
        if (phys && phys.body) {
          phys.body.setPosition(newX, newY);
          this.app.physics.system.updateBody(phys.body);
        }
      }
      this.app.attachmentSystem.update(this.app.world, this.app.physics);
    } else if (this.dragState.tool === 'rotate') {
      const anchor = this.dragState.anchorPos;
      const currentAngle = Math.atan2(worldPoint.y - anchor.y, worldPoint.x - anchor.x);
      this.dragState.currentAngle = currentAngle;

      let deltaAngle = currentAngle - this.dragState.startAngle;
      deltaAngle = Math.atan2(Math.sin(deltaAngle), Math.cos(deltaAngle));

      if (shiftKey) {
        const snapStep = EDITOR_CONFIG.angleSnapStep;
        deltaAngle = Math.round(deltaAngle / snapStep) * snapStep;
      }

      this.dragState.appliedDeltaAngle = deltaAngle;

      for (const [entId, initData] of this.dragState.initialEntities.entries()) {
        const t = this.app.world.getComponent(entId, 'transform');
        const phys = this.app.world.getComponent(entId, 'physicsBody');

        let newAngle = (initData.angle + deltaAngle) % (Math.PI * 2);
        if (newAngle > Math.PI) newAngle -= Math.PI * 2;
        if (newAngle < -Math.PI) newAngle += Math.PI * 2;

        let newX = initData.pos.x;
        let newY = initData.pos.y;

        if (this.dragState.initialEntities.size > 1) {
          const relX = initData.pos.x - anchor.x;
          const relY = initData.pos.y - anchor.y;
          newX = anchor.x + relX * Math.cos(deltaAngle) - relY * Math.sin(deltaAngle);
          newY = anchor.y + relX * Math.sin(deltaAngle) + relY * Math.cos(deltaAngle);
        }

        if (t) {
          t.x = newX;
          t.y = newY;
          t.angle = newAngle as Radians;
        }
        if (phys && phys.body) {
          phys.body.setPosition(newX, newY);
          if (typeof phys.body.setAngle === 'function') {
            phys.body.setAngle(newAngle);
          }
          this.app.physics.system.updateBody(phys.body);
        }
      }
      this.app.attachmentSystem.update(this.app.world, this.app.physics);
    }
  }

  public endDrag(): void {
    if (!this.dragState) return;

    this.applyPendingDrag();

    let shouldCommit = false;
    if (this.dragState.tool === 'translate') {
      const dx = this.dragState.currentPoint.x - this.dragState.startPoint.x;
      const dy = this.dragState.currentPoint.y - this.dragState.startPoint.y;
      if (Math.hypot(dx, dy) > 0.5) {
        shouldCommit = true;
      }
    } else if (this.dragState.tool === 'rotate') {
      let rawDelta = this.dragState.currentAngle - this.dragState.startAngle;
      const deltaAngle = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
      if (Math.abs(deltaAngle) > 0.01) {
        shouldCommit = true;
      }
    }

    if (shouldCommit && this.tx) {
      this.tx.commit();
    }

    this.cancelDrag(false);
  }

  public cancelDrag(revert: boolean = false): void {
    this.pendingDragPoint = null;
    if (revert && this.dragState) {
      for (const [entId, initData] of this.dragState.initialEntities.entries()) {
        const t = this.app.world.getComponent(entId, 'transform');
        const phys = this.app.world.getComponent(entId, 'physicsBody');
        if (t) {
          t.x = initData.pos.x;
          t.y = initData.pos.y;
          t.angle = initData.angle;
        }
        if (phys && phys.body) {
          phys.body.setPosition(initData.pos.x, initData.pos.y);
          if (typeof phys.body.setAngle === 'function') {
            phys.body.setAngle(initData.angle);
          }
          this.app.physics.system.updateBody(phys.body);
        }
      }
      this.app.attachmentSystem.update(this.app.world, this.app.physics);
    }
    this.activeHandle = null;
    this.dragState = null;
    this.tx = null;
  }

  public isDragging(): boolean {
    return this.dragState !== null;
  }
}
