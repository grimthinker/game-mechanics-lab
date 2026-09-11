import * as THREE from 'three';
import { IRenderer, RenderContext } from './IRenderer';
import { Camera } from '../Camera';
import { Point } from '../types';
import { EntityId } from '../ecs/types';
import { World } from '../ecs/World';

export class ThreeRenderer implements IRenderer {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiCtx: CanvasRenderingContext2D;

  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectionPoint = new THREE.Vector3();
  private mouseNDC = new THREE.Vector2();

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

    // Добавляем сетку для ориентации в пространстве
    const grid = new THREE.GridHelper(5000, 100, 0x444444, 0x222222);
    this.scene.add(grid);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public screenToWorld(clientX: number, clientY: number, _camera2D: Camera): Point {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectionPoint);

    if (hit) {
      // 3D X -> 2D X, 3D Z -> 2D Y
      return { x: hit.x, y: hit.z };
    }
    return { x: 0, y: 0 };
  }

  public pickEntity(clientX: number, clientY: number): EntityId | null {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      if (hit.object.userData.isSelectionOutline || hit.object instanceof THREE.GridHelper) {
        continue;
      }
      let curr: THREE.Object3D | null = hit.object;
      while (curr) {
        if (curr.userData && curr.userData.entityId) {
          return curr.userData.entityId;
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
    this.renderer.dispose();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.uiCanvas && this.uiCanvas.parentNode) {
      this.uiCanvas.parentNode.removeChild(this.uiCanvas);
    }
  }

  public render(context: RenderContext): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = context.camera.scale;

    // Вычисляем центральную точку мира, на которую смотрит камера
    const centerX = (w / 2 - context.camera.offsetX) / scale;
    const centerY = (h / 2 - context.camera.offsetY) / scale;

    // Сферические координаты на основе зума и поворота/наклона
    const dist = Math.max(200, 800 / scale);
    const camY = dist * Math.sin(context.camera.pitch);
    const groundDist = dist * Math.cos(context.camera.pitch);

    // Синхронизированный поворот с 2D (знак плюс обеспечивает вращение по часовой стрелке)
    const camX = centerX + groundDist * Math.sin(context.camera.yaw);
    const camZ = centerY + groundDist * Math.cos(context.camera.yaw);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(centerX, 0, centerY);

    this.renderer.render(this.scene, this.camera);

    // --- Отрисовка 2D UI поверх 3D сцены ---
    this.uiCtx.clearRect(0, 0, w, h);

    if (context.showUIOverlays) {
      this.renderUIOverlays(context.world, context.gameMode);
    }
    if (context.editorData.hoveredId) {
      this.renderItemTooltip(context.world, context.editorData.hoveredId);
    }
  }

  private renderUIOverlays(world: World, gameMode: string): void {
    const entities = world.getEntitiesWith('transform', 'meta');
    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;

    for (const [id, entity] of entities) {
      const tag = world.getComponent(id, 'tag');
      const archetype = tag?.archetype ?? entity.meta?.entityType;

      // Имена для предметов показываются через тултип, а маркеры в 3D скрыты
      if (archetype === 'item' || archetype === 'marker') continue;

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

      // Определяем высоту 3D-модели для позиционирования UI над ней
      let meshHeight = 40;
      if (isObstacle) meshHeight = 60;
      if (archetype === 'zone') meshHeight = 2;

      // Проекция 3D точки (верхушка меша) на 2D экран
      const pos3D = new THREE.Vector3(transform.x, meshHeight + 5, transform.y);
      pos3D.project(this.camera);

      // Отбрасываем объекты за спиной камеры
      if (pos3D.z > 1) continue;

      const screenX = (pos3D.x * 0.5 + 0.5) * w;
      const screenY = (-(pos3D.y * 0.5) + 0.5) * h;

      this.uiCtx.save();
      this.uiCtx.globalAlpha = overlayAlpha;
      this.uiCtx.translate(screenX, screenY);

      // Отрисовка полоски здоровья (только если есть компонент health)
      if (health) {
        const hp = health.current;
        const maxHp = health.max.current;
        const barW = Math.max(30, radius * 1.5);
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
      this.uiCtx.fillText(displayName, 0, health ? -14 : -4);

      this.uiCtx.restore();
    }
  }

  private renderItemTooltip(world: World, hoveredId: string): void {
    const entity = world.getEntity(hoveredId);
    if (!entity || !entity.transform || !entity.item) return;

    const transform = entity.transform;
    const radius = entity.physicsStats?.radius.current ?? 16;
    const meshHeight = radius * 1.5;

    const pos3D = new THREE.Vector3(transform.x, meshHeight + 15, transform.y);
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
}
