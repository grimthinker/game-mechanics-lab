import * as THREE from 'three';
import { IRenderer, RenderContext } from './IRenderer';
import { Camera } from '../Camera';
import { Point } from '../types';
import { EntityId } from '../ecs/types';

export class ThreeRenderer implements IRenderer {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
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
  }

  public destroy(): void {
    this.renderer.dispose();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  public render(context: RenderContext): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scale = context.camera.scale;

    // Вычисляем центральную точку мира, на которую смотрит 2D-камера
    const centerX = (w / 2 - context.camera.offsetX) / scale;
    const centerY = (h / 2 - context.camera.offsetY) / scale;

    // Динамическая высота камеры в 3D на основе зума 2D-камеры
    const camHeight = Math.max(200, 800 / scale);
    const camZOffset = camHeight * 0.6; // Смещение назад для угла обзора сверху-вниз

    // Позиционируем камеру (2D ось Y переходит в 3D ось Z)
    this.camera.position.set(centerX, camHeight, centerY + camZOffset);
    this.camera.lookAt(centerX, 0, centerY);

    this.renderer.render(this.scene, this.camera);
  }
}
