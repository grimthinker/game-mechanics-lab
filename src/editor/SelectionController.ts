import { Point } from '../types';
import { EventBus } from '../core/EventBus';
import { EntityAdapter } from '../EntityAdapter';
import { GameMode } from '../config/gameConfig';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { VISUAL_CONFIG } from '../config/visualConfig';
import type { GameApp } from '../GameApp';

export class SelectionController {
  public selectedEntityId: string | null = null;
  public selectedEntityIds: Set<string> = new Set();
  public hoveredEntityId: string | null = null;

  private _cachedSelectedEntity: EntityAdapter | null = null;
  public marqueeBox: { start: Point; current: Point } | null = null;

  constructor(private app: GameApp) {}

  public get selectedEntity(): EntityAdapter | null {
    if (!this.selectedEntityId) return null;
    if (!this.app.world.getEntity(this.selectedEntityId)) {
      this.selectedEntityId = null;
      this._cachedSelectedEntity = null;
      return null;
    }
    if (!this._cachedSelectedEntity || this._cachedSelectedEntity.id !== this.selectedEntityId) {
      this._cachedSelectedEntity = new EntityAdapter(this.selectedEntityId, this.app.world);
    }
    return this._cachedSelectedEntity;
  }

  public get hoveredEntity(): EntityAdapter | null {
    if (!this.hoveredEntityId) return null;
    if (!this.app.world.getEntity(this.hoveredEntityId)) {
      this.hoveredEntityId = null;
      return null;
    }
    return new EntityAdapter(this.hoveredEntityId, this.app.world);
  }

  public selectEntity(id: string | null, clearGroup: boolean = false): void {
    let changed = false;

    if (clearGroup) {
      if (this.selectedEntityIds.size !== (id ? 1 : 0) || (id && !this.selectedEntityIds.has(id))) {
        changed = true;
      }
      this.selectedEntityIds.clear();
      if (id) this.selectedEntityIds.add(id);
    } else if (id && !this.selectedEntityIds.has(id)) {
      this.selectedEntityIds.add(id);
      changed = true;
    }

    if (this.selectedEntityId !== id) {
      this.selectedEntityId = id;
      this._cachedSelectedEntity = id ? new EntityAdapter(id, this.app.world) : null;
      changed = true;
    }

    if (changed) {
      this.emitSelectionChanged();
      this.app.updateBTData(true);
    }
  }

  public selectEntities(ids: string[]): void {
    this.selectedEntityIds = new Set(ids);
    this.selectEntity(ids.length > 0 ? ids[0] : null, false);
    this.emitSelectionChanged();
  }

  public deselectEntity(id: string): void {
    this.selectedEntityIds.delete(id);
    if (this.selectedEntityId === id) {
      const next = this.selectedEntityIds.values().next().value ?? null;
      this.selectEntity(next, false);
    } else {
      this.emitSelectionChanged();
    }
  }

  public startMarquee(startPoint: Point): void {
    this.marqueeBox = { start: startPoint, current: startPoint };
  }

  public updateMarquee(currentPoint: Point): void {
    if (this.marqueeBox) {
      this.marqueeBox.current = currentPoint;
    }
  }

  public endMarquee(typeFilters: Record<string, boolean>): string[] {
    if (!this.marqueeBox) return [];
    const start = this.marqueeBox.start;
    const current = this.marqueeBox.current;
    this.marqueeBox = null;

    if (Math.hypot(current.x - start.x, current.y - start.y) < EDITOR_CONFIG.marqueeThresholdPx) {
      this.selectEntity(null, true);
      return [];
    }

    const startX = start.x;
    const startY = start.y;
    const currentX = current.x;
    const currentY = current.y;

    const p1 = this.app.getCanvasPoint(startX, startY);
    const p2 = this.app.getCanvasPoint(currentX, startY);
    const p3 = this.app.getCanvasPoint(currentX, currentY);
    const p4 = this.app.getCanvasPoint(startX, currentY);

    const rawIds = this.app.physics.queryEntitiesInPolygon([p1, p2, p3, p4]);
    const filteredIds: string[] = [];

    for (const id of rawIds) {
      const renderable = this.app.world.getComponent(id, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const tag = this.app.world.getComponent(id, 'tag');
      const meta = this.app.world.getComponent(id, 'meta');
      const archetype = tag?.archetype ?? meta?.entityType ?? 'creature';

      if (typeFilters && typeFilters[archetype] === false) {
        continue;
      }

      filteredIds.push(id);
    }

    this.selectedEntityIds = new Set(filteredIds);
    this.selectEntity(filteredIds.length > 0 ? filteredIds[0] : null, false);
    return filteredIds;
  }

  public hoverEntity(id: string | null): void {
    if (this.hoveredEntityId === id) return;
    this.hoveredEntityId = id;
  }

  public pickEntityAt(worldPoint: Point, clientX?: number, clientY?: number): string | null {
    if (
      this.app.activeRendererMode === '3d' &&
      clientX !== undefined &&
      clientY !== undefined &&
      this.app.renderer.pickEntity
    ) {
      const hit3dId = this.app.renderer.pickEntity(clientX, clientY);
      if (hit3dId) return hit3dId;
    }

    const isEditor = this.app.gameMode === GameMode.EDITOR;
    const hitIds = this.app.physics.queryPointAt(worldPoint);
    const hits: { id: string; zIndex: number }[] = [];

    for (const entityId of hitIds) {
      const renderable = this.app.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.app.world.getComponent(entityId, 'physicsBody');
      const physStats = this.app.world.getComponent(entityId, 'physicsStats');
      if (!isEditor && !physicsBody && !physStats) continue;

      hits.push({ id: entityId, zIndex: renderable?.zIndex ?? 0 });
    }

    if (hits.length > 0) {
      hits.sort((a, b) => b.zIndex - a.zIndex);
      return hits[0].id;
    }

    if (isEditor) {
      return this.pickNearestEntity(worldPoint);
    }

    return null;
  }

  public pickNearestEntity(
    worldPoint: Point,
    maxDistanceRatio: number = VISUAL_CONFIG.creatureHoverScreenRatio ?? 0.02
  ): string | null {
    const isEditor = this.app.gameMode === GameMode.EDITOR;
    const maxScreenDistancePx = this.app.canvas.width * maxDistanceRatio;
    const maxWorldDist = maxScreenDistancePx / this.app.camera.scale;

    const candidates = this.app.physics.queryEntitiesInRadius(worldPoint, maxWorldDist);

    let nearestId: string | null = null;
    let minDistance = Infinity;
    let bestZIndex = -Infinity;

    for (const { id: entityId, overlap } of candidates) {
      const renderable = this.app.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.app.world.getComponent(entityId, 'physicsBody');
      const physStats = this.app.world.getComponent(entityId, 'physicsStats');
      if (!isEditor && !physicsBody && !physStats) continue;

      const distToBoundary = Math.max(0, maxWorldDist - overlap);
      const zIndex = renderable?.zIndex ?? 0;

      if (distToBoundary < minDistance - 0.001) {
        minDistance = distToBoundary;
        nearestId = entityId;
        bestZIndex = zIndex;
      } else if (Math.abs(distToBoundary - minDistance) <= 0.001 && zIndex > bestZIndex) {
        nearestId = entityId;
        bestZIndex = zIndex;
      }
    }

    return nearestId;
  }

  public emitSelectionChanged(): void {
    EventBus.emit('selection:changed', {
      selectedEntityId: this.selectedEntityId,
      selectedEntityIds: Array.from(this.selectedEntityIds),
    });
  }

  public clear(): void {
    this.selectedEntityIds.clear();
    this.selectedEntityId = null;
    this.hoveredEntityId = null;
    this._cachedSelectedEntity = null;
    this.marqueeBox = null;
    this.emitSelectionChanged();
  }
}
