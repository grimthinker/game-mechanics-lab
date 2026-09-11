import * as THREE from 'three';
import { IRenderer, RenderContext } from './IRenderer';

export class ThreeRenderer implements IRenderer {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

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
