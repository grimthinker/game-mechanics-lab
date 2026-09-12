import { World } from './ecs/World';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { StealthSystem } from './ecs/systems/StealthSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { AISystem } from './ecs/systems/AISystem';
import { CanvasRenderSyncSystem } from './ecs/systems/CanvasRenderSyncSystem';
import { InteractionSystem } from './ecs/systems/InteractionSystem';
import { ZoneTriggerSystem } from './ecs/systems/ZoneTriggerSystem';
import { ModifierSystem } from './ecs/systems/ModifierSystem';
import { AttachmentSystem } from './ecs/systems/AttachmentSystem';
import { Camera } from './Camera';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { ThreeSyncSystem } from './ecs/systems/ThreeSyncSystem';
import { IRenderer } from './rendering/IRenderer';
import { Point } from './types';
import { EntityAdapter } from './EntityAdapter';
import { EntityFactory } from './ecs/EntityFactory';
import { GameMode, CREATURE_HOVER_SCREEN_RATIO } from './constants';
import { WorldSerializer } from './ecs/WorldSerializer';
import { EntityConfig } from './ecs/types';
import { createDefaultCreatureConfig } from './Creature';
import { createZoneConfig } from './ecs/archetypes/ZoneArchetype';
import { deg2Rad, Radians } from './utils';
import { HistoryManager, HistoryRecord } from './history/HistoryManager';
import { GizmoTool, GizmoHandle, GizmoDragState, GizmoInitialEntityData } from './gizmos/types';

export { EntityAdapter } from './EntityAdapter';

export class GameApp {
  private container: HTMLDivElement;
  private renderer: IRenderer;
  public world: World;
  public history: HistoryManager = new HistoryManager(50);
  private isHistoryAction: boolean = false;
  private mouseScreenPos: Point | null = null;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private stealthSystem: StealthSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  public aiSystem: AISystem;
  private canvasRenderSyncSystem: CanvasRenderSyncSystem;
  private threeSyncSystem: ThreeSyncSystem | null = null;
  public interactionSystem: InteractionSystem;
  private zoneTriggerSystem: ZoneTriggerSystem;
  private modifierSystem: ModifierSystem;
  private attachmentSystem: AttachmentSystem;
  public camera: Camera;
  public activeRendererMode: '2d' | '3d' = '2d';
  public showUIOverlays: boolean = true;
  public showAIDebug: boolean = false;
  public entityFactory: EntityFactory;
  private serializer: WorldSerializer;

  public selectedEntityId: string | null = null;
  public selectedEntityIds: Set<string> = new Set();
  public hoveredEntityId: string | null = null;
  private _cachedSelectedEntity: EntityAdapter | null = null;

  // Рамка выделения
  public marqueeBox: { start: Point; current: Point } | null = null;

  // Интерактивные манипуляторы (Gizmos)
  public gizmoTool: GizmoTool = 'translate';
  public hoveredGizmoHandle: GizmoHandle | null = null;
  public activeGizmoHandle: GizmoHandle | null = null;
  public gizmoDragState: GizmoDragState | null = null;
  private gizmoStartSnapshot: HistoryRecord | null = null;
  private pendingGizmoDragPoint: { point: Point; shiftKey: boolean } | null = null;

  public get selectedEntity(): EntityAdapter | null {
    if (!this.selectedEntityId) return null;
    if (!this.world.getEntity(this.selectedEntityId)) {
      this.selectedEntityId = null;
      this._cachedSelectedEntity = null;
      return null;
    }
    if (!this._cachedSelectedEntity || this._cachedSelectedEntity.id !== this.selectedEntityId) {
      this._cachedSelectedEntity = new EntityAdapter(this.selectedEntityId, this.world);
    }
    return this._cachedSelectedEntity;
  }

  public get hoveredEntity(): EntityAdapter | null {
    if (!this.hoveredEntityId) return null;
    if (!this.world.getEntity(this.hoveredEntityId)) {
      this.hoveredEntityId = null;
      return null;
    }
    return new EntityAdapter(this.hoveredEntityId, this.world);
  }

  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  public isPaused: boolean = false;

  public gameMode: GameMode = GameMode.EDITOR;

  private handleResize = () => this.resizeCanvas();

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.renderer = new CanvasRenderer(container);
    this.world = new World();
    this.physics = new PhysicsSystem();
    this.movementSystem = new MovementSystem();
    this.stealthSystem = new StealthSystem();
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
    this.aiSystem = new AISystem();
    this.canvasRenderSyncSystem = new CanvasRenderSyncSystem();
    this.interactionSystem = new InteractionSystem();
    this.zoneTriggerSystem = new ZoneTriggerSystem();
    this.modifierSystem = new ModifierSystem();
    this.attachmentSystem = new AttachmentSystem();
    this.camera = new Camera();
    this.entityFactory = new EntityFactory();
    this.serializer = new WorldSerializer(this);

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);
  }

  public get canvas(): HTMLCanvasElement {
    return this.renderer.getCanvas();
  }

  public setRendererMode(mode: '2d' | '3d'): void {
    if (this.activeRendererMode === mode) return;
    this.activeRendererMode = mode;

    if (this.renderer.destroy) {
      this.renderer.destroy();
    }

    if (mode === '2d') {
      this.renderer = new CanvasRenderer(this.container);
      this.threeSyncSystem = null;
    } else {
      const threeRenderer = new ThreeRenderer(this.container);
      this.renderer = threeRenderer;
      this.threeSyncSystem = new ThreeSyncSystem(threeRenderer.scene);
    }
    this.resizeCanvas();
  }

  public resizeCanvas(width?: number, height?: number): void {
    let w = width;
    let h = height;
    if (w === undefined || h === undefined) {
      w = this.container.clientWidth;
      h = this.container.clientHeight;
    }
    this.renderer.resize(w, h);
  }

  public spawnEntity(config: EntityConfig, position?: Point, forcedId?: string): string {
    return this.entityFactory.spawnEntity(
      this.world,
      this.physics,
      this.aiSystem,
      config,
      position,
      forcedId
    );
  }

  public duplicateEntities(ids: string[], offset: Point = { x: 30, y: 30 }): string[] {
    const validIds = ids.filter((id) => this.world.getEntity(id));
    if (validIds.length === 0) return [];

    this.commitHistory('Клонирование объектов');

    const newIds: string[] = [];

    for (const id of validIds) {
      const comp = this.world.getEntity(id);
      if (!comp || !comp.transform) continue;

      const targetPos: Point = {
        x: comp.transform.x + offset.x,
        y: comp.transform.y + offset.y,
      };

      const config: EntityConfig = {};
      if (comp.tag) config.tag = JSON.parse(JSON.stringify(comp.tag));
      if (comp.meta) {
        config.meta = JSON.parse(JSON.stringify(comp.meta));
        config.meta!.name = `${comp.meta.name} (Копия)`;
      }
      if (comp.physicsStats) {
        config.physics = {
          radius: comp.physicsStats.radius.base,
          weight: comp.physicsStats.weight.base,
          isSolid: comp.physicsStats.isSolid,
          points: comp.physicsStats.points
            ? JSON.parse(JSON.stringify(comp.physicsStats.points))
            : undefined,
        };
      }
      if (comp.health) {
        config.health = {
          maxHp: comp.health.max.base,
          hp: comp.health.current,
        };
      }
      if (comp.movementStats) {
        config.movement = {
          maxSpeed: comp.movementStats.maxSpeed.base,
          maxTurnSpeed: comp.movementStats.maxTurnSpeed.base,
          runSpeedMultiplier: comp.movementStats.runSpeedMultiplier,
          crouchSpeedMultiplier: comp.movementStats.crouchSpeedMultiplier,
          walkSpeedMultiplier: comp.movementStats.walkSpeedMultiplier,
          runTurnMultiplier: comp.movementStats.runTurnMultiplier,
          crouchTurnMultiplier: comp.movementStats.crouchTurnMultiplier,
          strafeSpeedMultiplier: comp.movementStats.strafeSpeedMultiplier,
          backwardSpeedMultiplier: comp.movementStats.backwardSpeedMultiplier,
          strafeTurnMultiplier: comp.movementStats.strafeTurnMultiplier,
          backwardTurnMultiplier: comp.movementStats.backwardTurnMultiplier,
          pickupSpeedMultiplier: comp.movementStats.pickupSpeedMultiplier,
          pickupTurnMultiplier: comp.movementStats.pickupTurnMultiplier,
        };
      }
      if (comp.stealthStats) {
        config.stealth = {
          stealthPower: comp.stealthStats.stealthPower.base,
          runStealthMultiplier: comp.stealthStats.runStealthMultiplier,
          crouchStealthMultiplier: comp.stealthStats.crouchStealthMultiplier,
          walkStealthMultiplier: comp.stealthStats.walkStealthMultiplier,
          turnInPlaceStealthMultiplier: comp.stealthStats.turnInPlaceStealthMultiplier,
          immobileStealthMultiplier: comp.stealthStats.immobileStealthMultiplier,
        };
      }
      if (comp.aiStats) {
        config.ai = {
          behavior: comp.aiStats.behavior.current,
          stats: comp.aiStats.stats ? JSON.parse(JSON.stringify(comp.aiStats.stats)) : undefined,
        };
      }
      if (comp.zoneTrigger) {
        config.zoneTrigger = JSON.parse(JSON.stringify(comp.zoneTrigger));
      }
      if (comp.item) {
        config.item = JSON.parse(JSON.stringify(comp.item));
      }
      if (comp.weaponStats) {
        config.weaponStats = {
          baseDamage: comp.weaponStats.baseDamage.base,
          prepTime: comp.weaponStats.prepTime.base,
          castTime: comp.weaponStats.castTime.base,
          recoveryTime: comp.weaponStats.recoveryTime.base,
          prepTurnSlow: comp.weaponStats.prepTurnSlow,
          recoveryTurnSlow: comp.weaponStats.recoveryTurnSlow,
          prepMoveSlow: comp.weaponStats.prepMoveSlow,
          recoveryMoveSlow: comp.weaponStats.recoveryMoveSlow,
          castMoveSlow: comp.weaponStats.castMoveSlow,
          minMultiplier: comp.weaponStats.minMultiplier,
          maxMultiplier: comp.weaponStats.maxMultiplier,
          critChance: comp.weaponStats.critChance,
          critMultiplier: comp.weaponStats.critMultiplier,
        };
      }
      if (comp.weaponZone) {
        config.weaponZone = JSON.parse(JSON.stringify(comp.weaponZone));
      }
      if (comp.armorStats) {
        config.armorStats = {
          defense: comp.armorStats.defense.base,
          flatReduction: comp.armorStats.flatReduction.base,
        };
      }
      if (comp.inventory) {
        config.inventory = {
          size: { ...comp.inventory.size },
        };
      }
      if (comp.equip) {
        config.equip = JSON.parse(JSON.stringify(comp.equip));
        config.equip!.interactionSlots.forEach((s) => (s.itemId = null));
        config.equip!.equipmentAreas.forEach((a) => (a.itemIds = []));
      }
      if (comp.gizmo) {
        config.gizmo = JSON.parse(JSON.stringify(comp.gizmo));
      }
      config.transform = {
        x: targetPos.x,
        y: targetPos.y,
        angle: comp.transform.angle,
      };

      const newId = this.spawnEntity(config, targetPos);

      // Гарантируем перенос угла поворота (так как часть ассемблеров инициализируют угол в 0)
      const newTrans = this.world.getComponent(newId, 'transform');
      if (newTrans) {
        newTrans.angle = comp.transform.angle;
      }
      const newPhys = this.world.getComponent(newId, 'physicsBody');
      if (newPhys?.body && typeof newPhys.body.setAngle === 'function') {
        newPhys.body.setAngle(comp.transform.angle);
        this.physics.system.updateBody(newPhys.body);
      }

      newIds.push(newId);
    }

    if (newIds.length > 0) {
      this.selectedEntityIds = new Set(newIds);
      this.selectEntity(newIds[0], false);
    }

    return newIds;
  }

  public startPickup(entityId: string, targetItemId: string): boolean {
    return InteractionSystem.requestPickup(this.world, entityId, targetItemId);
  }

  public cancelInteraction(entityId: string): boolean {
    return this.interactionSystem.cancelInteraction(this.world, this.physics, entityId);
  }

  public deleteSelectedEntity(): void {
    this.deleteSelectedEntities();
  }

  public deleteSelectedEntities(): void {
    const ids = Array.from(
      this.selectedEntityIds.size > 0
        ? this.selectedEntityIds
        : this.selectedEntityId
          ? [this.selectedEntityId]
          : []
    );

    if (ids.length === 0) return;

    this.commitHistory('Удаление объектов');

    for (const id of ids) {
      this.deleteEntityRecursive(id);
      if (this.hoveredEntityId === id) this.hoveredEntityId = null;
    }

    this.selectedEntityIds.clear();
    this.selectEntity(null, true);
  }

  private deleteEntityRecursive(id: string): void {
    if (!this.world.getEntity(id)) return;

    // Каскадное удаление привязанных дочерних сущностей (ауры, зоны и т.д.)
    const attachedEntities = this.world.getEntitiesWith('attachment');
    for (const [childId, { attachment }] of attachedEntities) {
      if (attachment.parentId === id) {
        this.deleteEntityRecursive(childId);
      }
    }

    const eq = this.world.getComponent(id, 'equip');
    if (eq) {
      if (eq.interactionSlots) {
        for (const slot of eq.interactionSlots) {
          if (slot.itemId) this.deleteEntityRecursive(slot.itemId);
        }
      }
      if (eq.equipmentAreas) {
        for (const area of eq.equipmentAreas) {
          for (const itemId of area.itemIds) {
            this.deleteEntityRecursive(itemId);
          }
        }
      }
    }
    const inv = this.world.getComponent(id, 'inventory');
    if (inv) {
      for (const row of inv.slots) {
        for (const cell of row) {
          if (cell.itemId) this.deleteEntityRecursive(cell.itemId);
        }
      }
    }
    const phys = this.world.getComponent(id, 'physicsBody');
    if (phys) this.physics.unregisterBody(phys.body);
    this.aiSystem.unregisterEntity(id);
    this.world.removeEntity(id);
  }

  public clearWorld(): void {
    const entities = this.world.getAllEntities();
    for (const [id, comp] of entities) {
      if (comp.physicsBody) {
        this.physics.unregisterBody(comp.physicsBody.body);
      }
      this.world.removeEntity(id);
    }
    this.aiSystem.clear();
    this.selectEntity(null);
    this.hoverEntity(null);
  }

  public initDefaultWorld(center?: Point): void {
    this.clearWorld();
    this.history.clear();
    const spawnPos: Point = center ?? {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
    };

    this.spawnEntity(createDefaultCreatureConfig('PlayerTree'), spawnPos);
    this.spawnEntity(createZoneConfig('damage', 70, 15), { x: spawnPos.x + 180, y: spawnPos.y });
    this.spawnEntity(createZoneConfig('heal', 70, 15), { x: spawnPos.x - 180, y: spawnPos.y });
    this.spawnEntity(
      createZoneConfig('repel', 70, 200, 'Зона отталкивания', false, false, false, true, 7000, 0),
      {
        x: spawnPos.x - 180,
        y: spawnPos.y - 180,
      }
    );
    this.spawnEntity(
      createZoneConfig('attract', 70, 200, 'Зона притягивания', false, false, false, true, 7000, 0),
      {
        x: spawnPos.x + 180,
        y: spawnPos.y - 180,
      }
    );

    // Начальное разрушаемое препятствие по умолчанию
    this.spawnEntity(
      {
        tag: { archetype: 'obstacle' },
        meta: { name: 'Каменная стена', entityType: 'obstacle', destructible: true },
        health: { hp: 100, maxHp: 100 },
        physics: {
          radius: 65,
          weight: 1000,
          isSolid: true,
          points: [
            { x: -60, y: -25 },
            { x: 60, y: -25 },
            { x: 60, y: 25 },
            { x: -60, y: 25 },
          ],
        },
      },
      { x: spawnPos.x, y: spawnPos.y + 160 }
    );

    // Начальный спавн предметов в вертикальный ряд
    const itemsX = spawnPos.x + 80;

    // 1. Оружие с атакой в радиусе (Аура)
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Аура разрушения',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 30,
          prepTime: 0.3,
          castTime: 0,
          recoveryTime: 0.4,
        },
        weaponZone: {
          hitZoneType: 'radius',
          radius: 50,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y - 100 }
    );

    // 2. Оружие с атакой шрапнелью
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Шрапнельный дробовик',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 15,
          prepTime: 0.4,
          castTime: 0,
          recoveryTime: 0.5,
        },
        weaponZone: {
          hitZoneType: 'shrapnel',
          length: 120,
          angle: deg2Rad(60),
          rayCount: 5,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y - 50 }
    );

    // 3. Оружие с атакой на линии
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Копьё пронзания',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 25,
          prepTime: 0.2,
          castTime: 0,
          recoveryTime: 0.3,
        },
        weaponZone: {
          hitZoneType: 'forward_line',
          length: 150,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y }
    );

    // 4. Броня для туловища, вес 20
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Тяжёлый нагрудник',
          type: 'armor',
          maxStack: 1,
          size: 20,
          equipType: 'torso',
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 20, isSolid: true },
        armorStats: {
          defense: 25,
          flatReduction: 5,
        },
      },
      { x: itemsX, y: spawnPos.y + 50 }
    );

    // 5. Броня для головы, вес 10
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Стальной шлем',
          type: 'armor',
          maxStack: 1,
          size: 10,
          equipType: 'head',
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 10, isSolid: true },
        armorStats: {
          defense: 15,
          flatReduction: 2,
        },
      },
      { x: itemsX, y: spawnPos.y + 100 }
    );
  }

  public serializeWorld(): any {
    return this.serializer.serializeWorld();
  }

  public deserializeWorld(data: any): void {
    this.serializer.deserializeWorld(data);
  }

  public captureHistoryRecord(description: string = 'Действие'): HistoryRecord {
    return {
      description,
      worldSnapshot: this.serializeWorld(),
      selectedEntityIds: Array.from(this.selectedEntityIds),
      selectedEntityId: this.selectedEntityId,
    };
  }

  public commitHistory(description: string = 'Изменение'): void {
    if (this.gameMode !== GameMode.EDITOR || this.isHistoryAction) return;
    this.history.pushState(this.captureHistoryRecord(description));
  }

  public undo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.history.canUndo()) return false;

    this.isHistoryAction = true;
    try {
      const current = this.captureHistoryRecord('Текущее состояние');
      const target = this.history.undo(current);
      if (target) {
        this.restoreHistoryRecord(target);
        return true;
      }
    } finally {
      this.isHistoryAction = false;
    }
    return false;
  }

  public redo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.history.canRedo()) return false;

    this.isHistoryAction = true;
    try {
      const current = this.captureHistoryRecord('Текущее состояние');
      const target = this.history.redo(current);
      if (target) {
        this.restoreHistoryRecord(target);
        return true;
      }
    } finally {
      this.isHistoryAction = false;
    }
    return false;
  }

  private restoreHistoryRecord(record: HistoryRecord): void {
    this.deserializeWorld(record.worldSnapshot);
    this.selectedEntityIds.clear();
    for (const id of record.selectedEntityIds) {
      if (this.world.getEntity(id)) {
        this.selectedEntityIds.add(id);
      }
    }
    const targetId =
      record.selectedEntityId && this.world.getEntity(record.selectedEntityId)
        ? record.selectedEntityId
        : (this.selectedEntityIds.values().next().value ?? null);
    this.selectEntity(targetId, false);
    this.hoverEntity(null);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  public destroy(): void {
    this.isRunning = false;
    window.removeEventListener('resize', this.handleResize);
    if (this.renderer.destroy) {
      this.renderer.destroy();
    }
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    if (!this.isPaused) {
      if (this.gameMode === GameMode.GAME && this.mouseScreenPos) {
        const worldPoint = this.getCanvasPoint(this.mouseScreenPos.x, this.mouseScreenPos.y);
        this.updatePlayerAim(worldPoint);
      }

      this.modifierSystem.update(dt, this.world);
      this.aiSystem.update(dt, this.world);
      this.interactionSystem.update(dt, this.world, this.physics);
      this.attackSystem.update(dt, this.world, this.physics);
      this.movementSystem.update(dt, this.world);
      this.stealthSystem.update(dt, this.world);
      this.physics.update(dt, this.world);
      this.attachmentSystem.update(this.world, this.physics);
      this.zoneTriggerSystem.update(dt, this.world, this.physics);
      this.damageSystem.update(dt, this.world);
    }

    if (this.activeRendererMode === '2d') {
      this.canvasRenderSyncSystem.update(dt, this.world, this.gameMode);
    } else if (this.activeRendererMode === '3d' && this.threeSyncSystem) {
      this.threeSyncSystem.update(dt, this.world, this.gameMode, this.selectedEntityIds);
    }

    // Применяем накопленный ввод манипулятора строго 1 раз за кадр рендера (RAF Throttling)
    this.applyPendingGizmoDrag();

    let gizmoRenderData: import('./gizmos/types').GizmoRenderData | null = null;
    if (this.gameMode === GameMode.EDITOR && this.selectedEntityId && this.gizmoTool !== 'select') {
      const transform = this.world.getComponent(this.selectedEntityId, 'transform');
      if (transform) {
        let dragDelta: Point | undefined = undefined;
        let dragDeltaAngle: number | undefined = undefined;

        if (this.gizmoDragState) {
          dragDelta = {
            x: transform.x - this.gizmoDragState.anchorPos.x,
            y: transform.y - this.gizmoDragState.anchorPos.y,
          };
          dragDeltaAngle = this.gizmoDragState.appliedDeltaAngle;
        }

        gizmoRenderData = {
          tool: this.gizmoTool,
          position: { x: transform.x, y: transform.y },
          angle: transform.angle,
          initialAngle: this.gizmoDragState?.initialAnchorAngle,
          hoveredHandle: this.hoveredGizmoHandle,
          activeHandle: this.activeGizmoHandle,
          isDragging: this.isGizmoDragging(),
          dragDelta,
          dragDeltaAngle,
        };
      }
    }

    this.renderer.render({
      camera: this.camera,
      world: this.world,
      physics: this.physics,
      gameMode: this.gameMode,
      editorData: {
        selectedId: this.selectedEntityId,
        selectedIds: this.selectedEntityIds,
        hoveredId: this.hoveredEntityId,
        marqueeBox: this.marqueeBox,
        gizmo: gizmoRenderData,
        showAIDebug: this.showAIDebug,
      },
      showUIOverlays: this.showUIOverlays,
    });
    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectEntity(id: string | null, clearGroup: boolean = false): void {
    if (clearGroup) {
      this.selectedEntityIds.clear();
      if (id) this.selectedEntityIds.add(id);
    } else if (id && !this.selectedEntityIds.has(id)) {
      this.selectedEntityIds.add(id);
    }

    if (this.selectedEntityId === id) return;
    this.selectedEntityId = id;
    this._cachedSelectedEntity = id ? new EntityAdapter(id, this.world) : null;
  }

  public selectEntities(ids: string[]): void {
    this.selectedEntityIds = new Set(ids);
    this.selectEntity(ids.length > 0 ? ids[0] : null, false);
  }

  public deselectEntity(id: string): void {
    this.selectedEntityIds.delete(id);
    if (this.selectedEntityId === id) {
      const next = this.selectedEntityIds.values().next().value ?? null;
      this.selectEntity(next, false);
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

    const minX = Math.min(start.x, current.x);
    const maxX = Math.max(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const maxY = Math.max(start.y, current.y);

    // Если клик без растягивания (< 5px) — клик по пустому месту сбрасывает выбор
    if (Math.hypot(maxX - minX, maxY - minY) < 5) {
      this.selectEntity(null, true);
      return [];
    }

    const rawIds = this.physics.queryEntitiesInBox(minX, minY, maxX, maxY);
    const filteredIds: string[] = [];

    for (const id of rawIds) {
      const renderable = this.world.getComponent(id, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const tag = this.world.getComponent(id, 'tag');
      const meta = this.world.getComponent(id, 'meta');
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
      this.activeRendererMode === '3d' &&
      clientX !== undefined &&
      clientY !== undefined &&
      this.renderer.pickEntity
    ) {
      const hit3dId = this.renderer.pickEntity(clientX, clientY);
      if (hit3dId) return hit3dId;
    }

    const isEditor = this.gameMode === GameMode.EDITOR;
    const hitIds = this.physics.queryPointAt(worldPoint);
    const hits: { id: string; zIndex: number }[] = [];

    for (const entityId of hitIds) {
      const renderable = this.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.world.getComponent(entityId, 'physicsBody');
      const physStats = this.world.getComponent(entityId, 'physicsStats');
      if (!isEditor && !physicsBody && !physStats) continue;

      hits.push({ id: entityId, zIndex: renderable?.zIndex ?? 0 });
    }

    if (hits.length === 0) return null;
    hits.sort((a, b) => b.zIndex - a.zIndex);
    return hits[0].id;
  }

  public setMouseScreenPos(clientX: number | null, clientY: number | null): void {
    if (clientX === null || clientY === null) {
      this.mouseScreenPos = null;
    } else {
      this.mouseScreenPos = { x: clientX, y: clientY };
    }
  }

  public updatePlayerAim(worldPoint: Point): void {
    const entities = this.world.getEntitiesWith('transform', 'input', 'health', 'aiStats');
    for (const [, { transform, input, health, aiStats }] of entities) {
      if (health.isAlive && aiStats.behavior.current === 'PlayerTree') {
        const dx = worldPoint.x - transform.x;
        const dy = worldPoint.y - transform.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          input.targetLookAngle = Math.atan2(dy, dx) as Radians;
        }
      }
    }
  }

  public clearPlayerAim(): void {
    const entities = this.world.getEntitiesWith('input');
    for (const [, { input }] of entities) {
      input.targetLookAngle = undefined;
    }
  }

  public pickNearestEntity(
    worldPoint: Point,
    maxDistanceRatio: number = CREATURE_HOVER_SCREEN_RATIO
  ): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    const maxScreenDistancePx = this.canvas.width * maxDistanceRatio;
    const maxWorldDist = maxScreenDistancePx / this.camera.scale;

    const candidates = this.physics.queryEntitiesInRadius(worldPoint, maxWorldDist);

    let nearestId: string | null = null;
    let minDistance = Infinity;
    let bestZIndex = -Infinity;

    for (const { id: entityId, overlap } of candidates) {
      const renderable = this.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.world.getComponent(entityId, 'physicsBody');
      const physStats = this.world.getComponent(entityId, 'physicsStats');
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

  public startPan(clientX: number, clientY: number): void {
    this.camera.startPan(clientX, clientY);
  }
  public pan(clientX: number, clientY: number): void {
    this.camera.pan(clientX, clientY);
  }
  public endPan(): boolean {
    return this.camera.endPan();
  }
  public zoomAt(clientX: number, clientY: number, deltaY: number): void {
    this.camera.zoomAt(clientX, clientY, deltaY, this.canvas);
  }
  public getCanvasPoint(clientX: number, clientY: number): Point {
    return this.renderer.screenToWorld(clientX, clientY, this.camera);
  }

  // --- Управление манипуляторами (Gizmo Controller) ---

  public setPendingGizmoDrag(point: Point, shiftKey: boolean): void {
    this.pendingGizmoDragPoint = { point, shiftKey };
  }

  private applyPendingGizmoDrag(): void {
    if (!this.pendingGizmoDragPoint || !this.gizmoDragState) return;
    const { point, shiftKey } = this.pendingGizmoDragPoint;
    this.pendingGizmoDragPoint = null;
    this.updateGizmoDrag(point, shiftKey);
  }

  public hitTestGizmo(worldPoint: Point): import('./gizmos/types').GizmoHandle | null {
    if (!this.selectedEntityId || this.gizmoTool === 'select') return null;
    const transform = this.world.getComponent(this.selectedEntityId, 'transform');
    if (!transform) return null;

    const invScale = 1 / this.camera.scale;
    const gx = transform.x;
    const gy = transform.y;
    const mx = worldPoint.x;
    const my = worldPoint.y;

    if (this.gizmoTool === 'translate') {
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
    } else if (this.gizmoTool === 'rotate') {
      const ringRadius = 55 * invScale;
      const ringThickness = 10 * invScale;
      const dist = Math.hypot(mx - gx, my - gy);
      if (Math.abs(dist - ringRadius) <= ringThickness) {
        return 'rotate';
      }
    }

    return null;
  }

  public startGizmoDrag(handle: GizmoHandle, worldPoint: Point): boolean {
    if (!this.selectedEntityId) return false;
    const anchorTransform = this.world.getComponent(this.selectedEntityId, 'transform');
    if (!anchorTransform) return false;

    // Фиксируем снимок мира ДО начала трансформации для корректной работы Undo (Ctrl+Z)
    this.gizmoStartSnapshot = this.captureHistoryRecord('Трансформация манипулятором');

    const initialEntities = new Map<string, GizmoInitialEntityData>();
    const idsToDrag = this.selectedEntityIds.has(this.selectedEntityId)
      ? Array.from(this.selectedEntityIds)
      : [this.selectedEntityId];

    for (const entId of idsToDrag) {
      const t = this.world.getComponent(entId, 'transform');
      if (t) {
        initialEntities.set(entId, {
          pos: { x: t.x, y: t.y },
          angle: t.angle,
        });
      }
    }

    const anchorPos = { x: anchorTransform.x, y: anchorTransform.y };
    const startAngle = Math.atan2(worldPoint.y - anchorPos.y, worldPoint.x - anchorPos.x);

    this.activeGizmoHandle = handle;
    this.gizmoDragState = {
      tool: this.gizmoTool,
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

  public updateGizmoDrag(worldPoint: Point, shiftKey: boolean = false): void {
    if (!this.gizmoDragState) return;

    this.gizmoDragState.currentPoint = { x: worldPoint.x, y: worldPoint.y };

    if (this.gizmoDragState.tool === 'translate') {
      let rawDx = worldPoint.x - this.gizmoDragState.startPoint.x;
      let rawDy = worldPoint.y - this.gizmoDragState.startPoint.y;

      if (this.gizmoDragState.handle === 'x') {
        rawDy = 0;
      } else if (this.gizmoDragState.handle === 'y') {
        rawDx = 0;
      }

      if (shiftKey) {
        const snapGrid = 10;
        rawDx = Math.round(rawDx / snapGrid) * snapGrid;
        rawDy = Math.round(rawDy / snapGrid) * snapGrid;
      }

      for (const [entId, initData] of this.gizmoDragState.initialEntities.entries()) {
        const t = this.world.getComponent(entId, 'transform');
        const phys = this.world.getComponent(entId, 'physicsBody');
        const newX = initData.pos.x + rawDx;
        const newY = initData.pos.y + rawDy;

        if (t) {
          t.x = newX;
          t.y = newY;
        }
        if (phys && phys.body) {
          phys.body.setPosition(newX, newY);
          this.physics.system.updateBody(phys.body);
        }
      }
      this.attachmentSystem.update(this.world, this.physics);
    } else if (this.gizmoDragState.tool === 'rotate') {
      const anchor = this.gizmoDragState.anchorPos;
      const currentAngle = Math.atan2(worldPoint.y - anchor.y, worldPoint.x - anchor.x);
      this.gizmoDragState.currentAngle = currentAngle;

      // Нормализация разницы углов для предотвращения скачка при переходе через шов ±180°
      let deltaAngle = currentAngle - this.gizmoDragState.startAngle;
      deltaAngle = Math.atan2(Math.sin(deltaAngle), Math.cos(deltaAngle));

      if (shiftKey) {
        const snapStep = Math.PI / 12; // 15 градусов
        deltaAngle = Math.round(deltaAngle / snapStep) * snapStep;
      }

      this.gizmoDragState.appliedDeltaAngle = deltaAngle;

      for (const [entId, initData] of this.gizmoDragState.initialEntities.entries()) {
        const t = this.world.getComponent(entId, 'transform');
        const phys = this.world.getComponent(entId, 'physicsBody');

        let newAngle = (initData.angle + deltaAngle) % (Math.PI * 2);
        if (newAngle > Math.PI) newAngle -= Math.PI * 2;
        if (newAngle < -Math.PI) newAngle += Math.PI * 2;

        let newX = initData.pos.x;
        let newY = initData.pos.y;

        if (this.gizmoDragState.initialEntities.size > 1) {
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
          this.physics.system.updateBody(phys.body);
        }
      }
      this.attachmentSystem.update(this.world, this.physics);
    }
  }

  public endGizmoDrag(): void {
    if (!this.gizmoDragState) return;

    // Применяем последний необработанный кадр ввода перед фиксацией в истории
    this.applyPendingGizmoDrag();

    if (this.gizmoDragState.tool === 'translate') {
      const dx = this.gizmoDragState.currentPoint.x - this.gizmoDragState.startPoint.x;
      const dy = this.gizmoDragState.currentPoint.y - this.gizmoDragState.startPoint.y;
      if (Math.hypot(dx, dy) > 0.5 && this.gizmoStartSnapshot) {
        this.gizmoStartSnapshot.description = 'Смещение манипулятором';
        this.history.pushState(this.gizmoStartSnapshot);
      }
    } else if (this.gizmoDragState.tool === 'rotate') {
      let rawDelta = this.gizmoDragState.currentAngle - this.gizmoDragState.startAngle;
      const deltaAngle = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
      if (Math.abs(deltaAngle) > 0.01 && this.gizmoStartSnapshot) {
        this.gizmoStartSnapshot.description = 'Вращение манипулятором';
        this.history.pushState(this.gizmoStartSnapshot);
      }
    }

    this.cancelGizmoDrag(false);
  }

  public cancelGizmoDrag(revert: boolean = false): void {
    this.pendingGizmoDragPoint = null;
    if (revert && this.gizmoDragState) {
      for (const [entId, initData] of this.gizmoDragState.initialEntities.entries()) {
        const t = this.world.getComponent(entId, 'transform');
        const phys = this.world.getComponent(entId, 'physicsBody');
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
          this.physics.system.updateBody(phys.body);
        }
      }
      this.attachmentSystem.update(this.world, this.physics);
    }
    this.activeGizmoHandle = null;
    this.gizmoDragState = null;
    this.gizmoStartSnapshot = null;
  }

  public isGizmoDragging(): boolean {
    return this.gizmoDragState !== null;
  }
}
