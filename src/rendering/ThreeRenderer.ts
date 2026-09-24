import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { IRenderer, RenderContext } from './IRenderer';
import { Camera } from '../Camera';
import { Point, Vec3 } from '../types';
import { EntityId } from '../ecs/types';
import { World } from '../ecs/World';
import { EventBus } from '../core/EventBus';
import { GlobalInput } from '../input/GlobalInput';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { AI_DEBUG_CONFIG } from '../config/aiDebugConfig';
import { getEffectiveLogicBrain } from '../ecs/utils/anatomy';
import { getRootOwner } from '../ecs/utils/hierarchy';
import { LOGIC_CONFIG } from '../ai/config';

export class ThreeRenderer implements IRenderer {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiCtx: CanvasRenderingContext2D;

  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public transformControl: TransformControls;
  private isDraggingGizmo = false;
  private brushCursor: THREE.Mesh;

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectionPoint = new THREE.Vector3();
  private mouseNDC = new THREE.Vector2();

  // --- Временные векторы для оптимизации (Scratch vectors) ---
  private _tempV1 = new THREE.Vector3();
  private _tempV2 = new THREE.Vector3();
  private _tempV3 = new THREE.Vector3();
  private _tempV4 = new THREE.Vector3();
  private _camPos = new THREE.Vector3();
  private _camDir = new THREE.Vector3();

  constructor(container: HTMLDivElement) {
    this.container = container;

    // Создаем WebGL рендерер
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.container.appendChild(this.canvas);

    // Создаем неинтерактивный 2D-холст для UI (имена, healthbar'ы) поверх WebGL
    this.uiCanvas = document.createElement('canvas');
    this.uiCanvas.style.display = 'block';
    this.uiCanvas.style.width = '100%';
    this.uiCanvas.style.height = '100%';
    this.uiCanvas.style.position = 'absolute';
    this.uiCanvas.style.top = '0';
    this.uiCanvas.style.left = '0';
    this.uiCanvas.style.pointerEvents = 'none'; // Мышь прокликивает на WebGL
    this.container.appendChild(this.uiCanvas);
    this.uiCtx = this.uiCanvas.getContext('2d')!;

    // Инициализируем сцену
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1e1e1e');

    // Настраиваем камеру
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);

    // Добавляем освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 500, 300);
    this.scene.add(dirLight);

    // Метрическая сетка: 50x50 метров, шаг 1 метр
    const grid = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
    this.scene.add(grid);

    // 3D-оси координат (Красная: X, Зеленая: Y (Вверх), Синяя: Z)
    const axes = new THREE.AxesHelper(3);
    this.scene.add(axes);

    // Манипулятор TransformControls
    this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControl.getHelper());

    this.transformControl.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean(event.value);
      this.isDraggingGizmo = isDragging;
      EventBus.emit('gizmo:dragging-changed', { isDragging });
    });

    this.transformControl.addEventListener('change', () => {
      if (this.isDraggingGizmo && this.transformControl.object) {
        const id = this.transformControl.object.userData.entityId;
        if (id) {
          EventBus.emit('gizmo:drag-update', {
            id,
            position: this.transformControl.object.position.clone(),
            quaternion: this.transformControl.object.quaternion.clone(),
          });
        }
      }
    });

    const brushGeo = new THREE.RingGeometry(0.9, 1.0, 32);
    brushGeo.rotateX(-Math.PI / 2);
    this.brushCursor = new THREE.Mesh(
      brushGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf39c12,
        transparent: true,
        opacity: 0.8,
        depthTest: false, // Чтобы кольцо было видно сквозь неровности
        side: THREE.DoubleSide,
      })
    );
    this.brushCursor.visible = false;
    this.scene.add(this.brushCursor);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public screenToWorld(clientX: number, clientY: number, _camera: Camera): import('../types').Vec3 {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectionPoint);

    if (hit) {
      return { x: hit.x, y: 0, z: hit.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  public getScreenRay(clientX: number, clientY: number): { origin: Vec3; direction: Vec3 } {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const origin = this.raycaster.ray.origin;
    const direction = this.raycaster.ray.direction;

    return {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    };
  }

  public projectToScreen(pos: import('../types').Vec3): import('../types').Vec3 | null {
    const vector = this._tempV1.set(pos.x, pos.y, pos.z);
    vector.project(this.camera);

    // Если объект за спиной камеры
    if (vector.z > 1.0) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (vector.x * 0.5 + 0.5) * rect.width,
      y: (-(vector.y * 0.5) + 0.5) * rect.height,
      z: vector.z,
    };
  }

  public pickEntity(clientX: number, clientY: number): EntityId | null {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);

    // Исключаем тяжелый меш террейна (~32 000 полигонов), сетку и служебные объекты ДО вызова трассировки на CPU
    const pickableObjects: THREE.Object3D[] = [];
    for (let i = 0; i < this.scene.children.length; i++) {
      const child = this.scene.children[i];
      if (
        child.userData.isTerrainMesh ||
        child.userData.entityId === 'terrain' ||
        child instanceof THREE.GridHelper ||
        child === this.brushCursor ||
        child === this.transformControl.getHelper()
      ) {
        continue;
      }
      // Если это группа террейна с дочерним тяжелым мешем
      if (child.children && child.children.some((c) => c.userData.isTerrainMesh)) {
        continue;
      }
      pickableObjects.push(child);
    }

    const intersects = this.raycaster.intersectObjects(pickableObjects, true);

    for (const hit of intersects) {
      if (hit.object.userData.isSelectionOutline) {
        continue;
      }
      let curr: THREE.Object3D | null = hit.object;
      while (curr) {
        if (curr.userData && (curr.userData.partId || curr.userData.entityId)) {
          return curr.userData.partId || curr.userData.entityId;
        }
        curr = curr.parent;
      }
    }
    return null;
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.uiCanvas.width = width;
    this.uiCanvas.height = height;
  }

  public destroy(): void {
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }
    this.renderer.dispose();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.uiCanvas && this.uiCanvas.parentNode) {
      this.uiCanvas.parentNode.removeChild(this.uiCanvas);
    }
    if (this.transformControl) {
      this.transformControl.dispose();
    }
  }

  public render(context: RenderContext): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = context.camera.scale;

    // Точка фокуса берется напрямую из 3D-камеры в мировых координатах
    const centerX = context.camera.targetX;
    const centerY = context.camera.targetY;
    const centerZ = context.camera.targetZ;

    // Сферические координаты орбиты в метрах
    const dist = Math.max(4, 18 / scale);
    const camY = centerY + dist * Math.sin(context.camera.pitch);
    const groundDist = dist * Math.cos(context.camera.pitch);

    const camX = centerX + groundDist * Math.sin(context.camera.yaw);
    const camZ = centerZ + groundDist * Math.cos(context.camera.yaw);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(centerX, centerY, centerZ);

    // Синхронизация манипулятора
    if (
      context.gameMode === 'editor' &&
      context.editorData.selectedId &&
      context.editorData.gizmoTool &&
      context.editorData.gizmoTool !== 'select'
    ) {
      const mesh = this.scene.children.find(
        (c) => c.userData.entityId === context.editorData.selectedId
      );
      const isOwned = !!context.world.getComponent(context.editorData.selectedId, 'ownership');

      if (mesh && !isOwned) {
        if (this.transformControl.object !== mesh) {
          this.transformControl.attach(mesh);
        }
        if (this.transformControl.getMode() !== context.editorData.gizmoTool) {
          this.transformControl.setMode(context.editorData.gizmoTool);
        }

        // Привязка к сетке через Shift
        if (GlobalInput.keys.has('shift')) {
          this.transformControl.setTranslationSnap(EDITOR_CONFIG.gridSnapSize);
          this.transformControl.setRotationSnap(EDITOR_CONFIG.angleSnapStep);
        } else {
          this.transformControl.setTranslationSnap(null);
          this.transformControl.setRotationSnap(null);
        }
      } else {
        this.transformControl.detach();
      }
    } else {
      this.transformControl.detach();
    }

    // Отрисовка 3D-курсора кисти террейна
    if (context.editorData.terrainBrush?.active && context.editorData.cursorWorldPos) {
      this.brushCursor.visible = true;
      this.brushCursor.position.set(
        context.editorData.cursorWorldPos.x,
        context.editorData.cursorWorldPos.y + 0.1,
        context.editorData.cursorWorldPos.z
      );
      const r = context.editorData.terrainBrush.radius;
      this.brushCursor.scale.set(r, r, r);

      (this.brushCursor.material as THREE.MeshBasicMaterial).color.setHex(
        context.editorData.terrainBrush.tool === 'paint' ? 0x3498db : 0xf39c12
      );
    } else {
      this.brushCursor.visible = false;
    }

    this.renderer.render(this.scene, this.camera);

    // --- Отрисовка 2D UI поверх 3D сцены ---
    this.uiCtx.clearRect(0, 0, w, h);

    if (context.showUIOverlays) {
      this.renderUIOverlays(context.world, context.gameMode);
    }
    if (context.editorData.hoveredId) {
      this.renderItemTooltip(context.world, context.editorData.hoveredId);
    }
    if (context.editorData.marqueeBox) {
      this.renderScreenMarqueeBox(context.editorData.marqueeBox);
    }
    if (context.editorData.showAIDebug) {
      const activeSelectedId =
        context.editorData.selectedId ??
        (context.editorData.selectedIds.size > 0
          ? context.editorData.selectedIds.values().next().value
          : null);
      if (activeSelectedId) {
        this.renderAIDebug(context.world, activeSelectedId);
      }
    }
  }

  private renderScreenMarqueeBox(box: { start: Point; current: Point }): void {
    const rect = this.canvas.getBoundingClientRect();
    const startX = box.start.x - rect.left;
    const startY = box.start.y - rect.top;
    const currentX = box.current.x - rect.left;
    const currentY = box.current.y - rect.top;

    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    this.uiCtx.save();
    this.uiCtx.fillStyle = 'rgba(52, 152, 219, 0.15)';
    this.uiCtx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
    this.uiCtx.lineWidth = 1.5;
    this.uiCtx.setLineDash([5, 3]);
    this.uiCtx.fillRect(minX, minY, width, height);
    this.uiCtx.strokeRect(minX, minY, width, height);
    this.uiCtx.restore();
  }

  private renderUIOverlays(world: World, gameMode: string): void {
    const entities = world.getEntitiesWith('transform', 'meta');
    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;

    for (const [id, entity] of entities) {
      const tag = world.getComponent(id, 'tag');
      const archetype = tag?.archetype ?? entity.meta?.entityType;

      // Имена для предметов показываются через тултип, маркеры и части тела скрыты в общем оверлее
      if (archetype === 'item' || archetype === 'marker' || archetype === 'bodyPart') continue;

      const health = world.getComponent(id, 'health');
      if (health && !health.isAlive) continue;

      const transform = entity.transform;
      const meta = entity.meta;
      const isObstacle = archetype === 'obstacle';

      if (isObstacle) {
        if (!meta?.destructible) continue;
        if (gameMode === 'game') {
          if (!health?.healthBarTimer || health.healthBarTimer <= 0) continue;
        }
      }

      let overlayAlpha = 1;
      if (isObstacle && gameMode === 'game' && health?.healthBarTimer) {
        overlayAlpha = Math.min(1, Math.max(0, health.healthBarTimer / 0.3));
      }

      const physStats = world.getComponent(id, 'physicsStats');
      const radius = physStats?.radius.current ?? 16;

      // Метрическая высота моделей для позиционирования UI над ними
      let meshHeight = 1.8;
      if (isObstacle) meshHeight = 1.6;
      else if (archetype === 'zone') meshHeight = 0.1;
      else if (archetype === 'creature') meshHeight = 1.8;

      // Проекция 3D точки (верхушка меша) на 2D экран
      const pos3D = this._tempV1.set(transform.x, transform.y + meshHeight + 0.3, transform.z);
      pos3D.project(this.camera);

      // Отбрасываем объекты за спиной камеры
      if (pos3D.z > 1) continue;

      const screenX = (pos3D.x * 0.5 + 0.5) * w;
      const screenY = (-(pos3D.y * 0.5) + 0.5) * h;

      this.uiCtx.save();
      this.uiCtx.globalAlpha = overlayAlpha;
      this.uiCtx.translate(screenX, screenY);

      // Отрисовка полоски здоровья (только для разрушаемых препятствий согласно п. 10 ТЗ)
      if (health && isObstacle) {
        const hp = health.current;
        const maxHp = health.max.current;
        // Увеличим ширину бара, чтобы она не была слишком маленькой для метрических радиусов
        const barW = Math.max(30, radius * 30);
        const barH = 5;
        const hpRatio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));

        this.uiCtx.fillStyle = 'rgba(0,0,0,0.6)';
        this.uiCtx.fillRect(-barW / 2, -10, barW, barH);
        this.uiCtx.fillStyle = '#2ecc71';
        this.uiCtx.fillRect(-barW / 2, -10, barW * hpRatio, barH);
      }

      // Отрисовка текста ID/Name
      this.uiCtx.fillStyle = '#ffffff';
      this.uiCtx.font = '11px sans-serif';
      this.uiCtx.textAlign = 'center';
      this.uiCtx.textBaseline = 'bottom';
      const displayName = meta?.name ?? id;
      this.uiCtx.fillText(displayName, 0, health && isObstacle ? -14 : -4);

      this.uiCtx.restore();
    }
  }

  private renderItemTooltip(world: World, hoveredId: string): void {
    const entity = world.getEntity(hoveredId);
    if (!entity || !entity.transform || !entity.item) return;

    const transform = entity.transform;
    const radius = entity.physicsStats?.radius.current ?? 0.4;
    const meshHeight = Math.max(0.3, radius * 1.5);

    // Корректные 3D координаты в метрах (высота Y + сдвиг, глубина Z)
    const pos3D = this._tempV1.set(transform.x, transform.y + meshHeight + 0.2, transform.z);
    pos3D.project(this.camera);

    if (pos3D.z > 1) return;

    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;
    const screenX = (pos3D.x * 0.5 + 0.5) * w;
    const screenY = (-(pos3D.y * 0.5) + 0.5) * h;

    this.uiCtx.save();
    this.uiCtx.translate(screenX, screenY);
    this.uiCtx.fillStyle = '#f1c40f';
    this.uiCtx.font = 'bold 12px sans-serif';
    this.uiCtx.textAlign = 'center';
    this.uiCtx.textBaseline = 'bottom';
    this.uiCtx.shadowColor = '#000';
    this.uiCtx.shadowBlur = 4;
    this.uiCtx.shadowOffsetX = 1;
    this.uiCtx.shadowOffsetY = 1;
    this.uiCtx.fillText(entity.item.name, 0, 0);
    this.uiCtx.restore();
  }

  private renderAIDebug(world: World, selectedId: string): void {
    const entity = world.getEntity(selectedId);
    if (!entity) return;

    const rootId = getRootOwner(world, selectedId) ?? selectedId;
    const rootEntity = world.getEntity(rootId) ?? entity;

    const transform = entity.transform ?? rootEntity.transform;
    if (!transform) return;

    const posX = transform.x;
    const posY = transform.y;
    const posZ = transform.z;

    const brain =
      getEffectiveLogicBrain(world, selectedId) ?? getEffectiveLogicBrain(world, rootId);
    const bb = brain?.blackboard;

    const aiStats = rootEntity.aiStats ?? entity.aiStats;
    const perception = rootEntity.perception ?? entity.perception;

    let detectRadius: number | undefined = bb?.get('detectDist') ?? bb?.get('detect_dist');
    if (detectRadius === undefined || Number.isNaN(detectRadius)) {
      if (perception && perception.visionMaxDistance > 0) {
        detectRadius = Math.max(perception.visionMaxDistance, perception.hearingMaxDistance ?? 0);
      } else if (aiStats?.stats?.detectDist !== undefined) {
        detectRadius = aiStats.stats.detectDist;
      } else {
        detectRadius = LOGIC_CONFIG.detectDist;
      }
    }

    let loseRadius: number | undefined =
      bb?.get('loseTargetDist') ?? bb?.get('lose_target_dist') ?? bb?.get('loseDist');
    if (loseRadius === undefined || Number.isNaN(loseRadius)) {
      if (aiStats?.stats?.loseTargetDist !== undefined) {
        loseRadius = aiStats.stats.loseTargetDist;
      } else if (detectRadius !== undefined && detectRadius > 0) {
        loseRadius = detectRadius * 1.4;
      } else {
        loseRadius = LOGIC_CONFIG.loseTargetDist;
      }
    }

    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;

    // 1. Отрисовка радиуса поиска цели (Detect Radius)
    if (detectRadius !== undefined && detectRadius > 0) {
      this.drawProjectedCircle(
        posX,
        posY,
        posZ,
        detectRadius,
        AI_DEBUG_CONFIG.colors.detectRadius,
        AI_DEBUG_CONFIG.dashArrays.radii,
        `Detect: ${detectRadius.toFixed(1)}m`,
        0
      );
    }

    // 2. Отрисовка радиуса потери цели (Lose Target Radius)
    if (loseRadius !== undefined && loseRadius > 0) {
      this.drawProjectedCircle(
        posX,
        posY,
        posZ,
        loseRadius,
        AI_DEBUG_CONFIG.colors.loseRadius,
        AI_DEBUG_CONFIG.dashArrays.radii,
        `Lose: ${loseRadius.toFixed(1)}m`,
        Math.PI / 4
      );
    }

    const selfYOffset = posY + 0.8;

    // 3. Линия к target_pos (если задано в памяти)
    const targetPosVal =
      bb?.get('target_pos') ??
      bb?.get('targetPos') ??
      bb?.get('target_position') ??
      bb?.get('targetPosition');

    if (targetPosVal !== undefined && targetPosVal !== null) {
      let targetX = 0,
        targetY = 0,
        targetZ = 0;
      let hasTargetPos = false;

      if (typeof targetPosVal === 'object') {
        if (Array.isArray(targetPosVal)) {
          if (targetPosVal.length >= 3) {
            targetX = Number(targetPosVal[0]) || 0;
            targetY = Number(targetPosVal[1]) || 0;
            targetZ = Number(targetPosVal[2]) || 0;
            hasTargetPos = true;
          } else if (targetPosVal.length >= 2) {
            targetX = Number(targetPosVal[0]) || 0;
            targetY = 0.1;
            targetZ = Number(targetPosVal[1]) || 0;
            hasTargetPos = true;
          }
        } else if (
          typeof targetPosVal === 'object' &&
          targetPosVal !== null &&
          'x' in targetPosVal
        ) {
          const posObj = targetPosVal as { x?: unknown; y?: unknown; z?: unknown };
          targetX = Number(posObj.x) || 0;
          if ('z' in posObj && posObj.z !== undefined) {
            targetY = Number(posObj.y) || 0.1;
            targetZ = Number(posObj.z) || 0;
          } else {
            targetY = 0.1;
            targetZ = Number(posObj.y) || 0;
          }
          hasTargetPos = true;
        }
      }

      if (hasTargetPos) {
        this.drawProjectedLine(
          posX,
          selfYOffset,
          posZ,
          targetX,
          targetY,
          targetZ,
          AI_DEBUG_CONFIG.colors.pathLine,
          AI_DEBUG_CONFIG.dashArrays.path,
          2
        );

        // Маркер точки target_pos
        const proj = this._tempV1.set(targetX, targetY, targetZ).project(this.camera);
        if (proj.z <= 1.0) {
          const sx = (proj.x * 0.5 + 0.5) * w;
          const sy = (-(proj.y * 0.5) + 0.5) * h;

          this.uiCtx.save();
          this.uiCtx.strokeStyle = AI_DEBUG_CONFIG.colors.pathLine;
          this.uiCtx.fillStyle = AI_DEBUG_CONFIG.colors.pathLine;
          this.uiCtx.lineWidth = 2;
          this.uiCtx.beginPath();
          this.uiCtx.arc(sx, sy, 4, 0, Math.PI * 2);
          this.uiCtx.fill();
          this.uiCtx.stroke();
          this.uiCtx.restore();

          this.renderBadge('target_pos', sx, sy - 12, AI_DEBUG_CONFIG.colors.pathLine, '#ffffff');
        }
      }
    }

    // 4. Линия к targetId (если задано в памяти)
    const targetIdVal = bb?.get('targetId') ?? bb?.get('target_id');
    if (targetIdVal !== undefined && targetIdVal !== null && String(targetIdVal).trim() !== '') {
      const targetIdStr = String(targetIdVal);
      const targetEntity = world.getEntity(targetIdStr);
      const targetOwnerRoot = getRootOwner(world, targetIdStr);
      const targetTrans =
        world.getComponent(targetIdStr, 'transform') ??
        (targetOwnerRoot ? world.getComponent(targetOwnerRoot, 'transform') : undefined);

      if (targetTrans) {
        const tX = targetTrans.x;
        const tY = targetTrans.y + 0.8;
        const tZ = targetTrans.z;

        this.drawProjectedLine(
          posX,
          selfYOffset,
          posZ,
          tX,
          tY,
          tZ,
          AI_DEBUG_CONFIG.colors.targetLine,
          AI_DEBUG_CONFIG.dashArrays.targetLine,
          2
        );

        const proj = this._tempV1.set(tX, tY, tZ).project(this.camera);
        if (proj.z <= 1.0) {
          const sx = (proj.x * 0.5 + 0.5) * w;
          const sy = (-(proj.y * 0.5) + 0.5) * h;

          const targetMeta =
            targetEntity?.meta ??
            (targetOwnerRoot ? world.getComponent(targetOwnerRoot, 'meta') : undefined);
          const targetName = targetMeta?.name ?? targetIdStr;

          this.renderBadge(
            `Target: ${targetName}`,
            sx,
            sy - 16,
            AI_DEBUG_CONFIG.colors.targetLine,
            '#ff8a80'
          );
        }
      }
    }
  }

  private drawProjectedCircle(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    strokeColor: string,
    dashArray: number[],
    label?: string,
    labelAngle: number = 0,
    segments: number = 64
  ): void {
    if (radius <= 0) return;

    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;

    this.uiCtx.save();
    this.uiCtx.strokeStyle = strokeColor;
    this.uiCtx.lineWidth = 1.5;
    this.uiCtx.setLineDash(dashArray);

    let pathStarted = false;

    this.uiCtx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      this._tempV1
        .set(centerX + Math.cos(angle) * radius, centerY + 0.03, centerZ + Math.sin(angle) * radius)
        .project(this.camera);

      if (this._tempV1.z > 1.0) {
        pathStarted = false;
        continue;
      }

      const screenX = (this._tempV1.x * 0.5 + 0.5) * w;
      const screenY = (-(this._tempV1.y * 0.5) + 0.5) * h;

      if (!pathStarted) {
        this.uiCtx.moveTo(screenX, screenY);
        pathStarted = true;
      } else {
        this.uiCtx.lineTo(screenX, screenY);
      }
    }

    this.uiCtx.stroke();
    this.uiCtx.restore();

    if (label) {
      this._tempV1
        .set(
          centerX + Math.cos(labelAngle) * radius,
          centerY + 0.03,
          centerZ + Math.sin(labelAngle) * radius
        )
        .project(this.camera);
      if (this._tempV1.z <= 1.0) {
        const screenX = (this._tempV1.x * 0.5 + 0.5) * w;
        const screenY = (-(this._tempV1.y * 0.5) + 0.5) * h;
        this.renderBadge(label, screenX, screenY - 10, strokeColor);
      }
    }
  }

  private drawProjectedLine(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    strokeColor: string,
    dashArray: number[],
    lineWidth: number = 2
  ): void {
    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;

    const v1 = this._tempV1.set(fromX, fromY, fromZ).project(this.camera);
    const v2 = this._tempV2.set(toX, toY, toZ).project(this.camera);

    if (v1.z > 1.0 && v2.z > 1.0) return;

    const pFrom = this._tempV3.set(fromX, fromY, fromZ);
    const pTo = this._tempV4.set(toX, toY, toZ);

    if (v1.z > 1.0 || v2.z > 1.0) {
      this.camera.getWorldPosition(this._camPos);
      this.camera.getWorldDirection(this._camDir);

      // Вектора для вычисления дот-продукта (без изменения исходных pFrom/pTo)
      const dist1 = this._tempV1.copy(pFrom).sub(this._camPos).dot(this._camDir);
      const dist2 = this._tempV2.copy(pTo).sub(this._camPos).dot(this._camDir);
      const nearPlane = 0.2;

      if (dist1 < nearPlane && dist2 < nearPlane) return;

      if (dist1 < nearPlane) {
        const t = (nearPlane - dist1) / (dist2 - dist1);
        pFrom.lerp(pTo, t);
      } else if (dist2 < nearPlane) {
        const t = (nearPlane - dist2) / (dist1 - dist2);
        pTo.lerp(pFrom, t);
      }

      const s1 = pFrom.project(this.camera);
      const s2 = pTo.project(this.camera);
      if (s1.z > 1.0 || s2.z > 1.0) return;

      this.uiCtx.save();
      this.uiCtx.strokeStyle = strokeColor;
      this.uiCtx.lineWidth = lineWidth;
      this.uiCtx.setLineDash(dashArray);
      this.uiCtx.beginPath();
      this.uiCtx.moveTo((s1.x * 0.5 + 0.5) * w, (-(s1.y * 0.5) + 0.5) * h);
      this.uiCtx.lineTo((s2.x * 0.5 + 0.5) * w, (-(s2.y * 0.5) + 0.5) * h);
      this.uiCtx.stroke();
      this.uiCtx.restore();
      return;
    }

    this.uiCtx.save();
    this.uiCtx.strokeStyle = strokeColor;
    this.uiCtx.lineWidth = lineWidth;
    this.uiCtx.setLineDash(dashArray);
    this.uiCtx.beginPath();
    this.uiCtx.moveTo((v1.x * 0.5 + 0.5) * w, (-(v1.y * 0.5) + 0.5) * h);
    this.uiCtx.lineTo((v2.x * 0.5 + 0.5) * w, (-(v2.y * 0.5) + 0.5) * h);
    this.uiCtx.stroke();
    this.uiCtx.restore();
  }

  private renderBadge(
    text: string,
    screenX: number,
    screenY: number,
    borderColor: string,
    textColor: string = AI_DEBUG_CONFIG.colors.badgeText
  ): void {
    this.uiCtx.save();
    this.uiCtx.font = 'bold 10px sans-serif';
    const textWidth = this.uiCtx.measureText(text).width;
    const paddingX = 6;
    const boxW = textWidth + paddingX * 2;
    const boxH = 16;
    const boxX = screenX - boxW / 2;
    const boxY = screenY - boxH / 2;

    this.uiCtx.fillStyle = AI_DEBUG_CONFIG.colors.badgeBg;
    this.uiCtx.fillRect(boxX, boxY, boxW, boxH);

    this.uiCtx.strokeStyle = borderColor;
    this.uiCtx.lineWidth = 1;
    this.uiCtx.setLineDash([]);
    this.uiCtx.strokeRect(boxX, boxY, boxW, boxH);

    this.uiCtx.fillStyle = textColor;
    this.uiCtx.textAlign = 'center';
    this.uiCtx.textBaseline = 'middle';
    this.uiCtx.fillText(text, screenX, screenY);
    this.uiCtx.restore();
  }
}
