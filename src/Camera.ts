import { Point } from './types';
import { CAMERA_CONFIG } from './config/cameraConfig';
import { BALANCE_CONFIG } from './config/balanceConfig';
import { angleDifference, normalizeAngle } from './utils';

export interface CameraState {
  scale: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  yaw: number;
  pitch: number;
}

export class Camera {
  public scale: number = CAMERA_CONFIG.defaultZoom;
  public targetX: number = 0;
  public targetY: number = 0;
  public targetZ: number = 0;
  public yaw: number = 0;
  public pitch: number = CAMERA_CONFIG.defaultPitch;
  public readonly minScale: number = CAMERA_CONFIG.minScale;
  public readonly maxScale: number = CAMERA_CONFIG.maxScale;

  // Целевые параметры для непрерывного плавного подтягивания (smoothing)
  public desiredTargetX: number = 0;
  public desiredTargetY: number = 0;
  public desiredTargetZ: number = 0;
  public desiredYaw: number = 0;
  public desiredPitch: number = CAMERA_CONFIG.defaultPitch;
  public desiredDistance: number = 18.0 / CAMERA_CONFIG.defaultZoom;

  // Настройки чувствительности (с сохранением в localStorage)
  public panSpeed: number =
    Number(localStorage.getItem('camera_pan_speed')) || CAMERA_CONFIG.defaultPanSpeed;
  public rotateSpeed: number =
    Number(localStorage.getItem('camera_rotate_speed')) || CAMERA_CONFIG.defaultRotateSpeed;

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

  public isRotating: boolean = false;
  private rotStartX: number = 0;
  private rotStartY: number = 0;

  public setPanSpeed(val: number): void {
    this.panSpeed = val;
    localStorage.setItem('camera_pan_speed', val.toString());
  }

  public setRotateSpeed(val: number): void {
    this.rotateSpeed = val;
    localStorage.setItem('camera_rotate_speed', val.toString());
  }

  public startRotate(clientX: number, clientY: number): void {
    this.isRotating = true;
    this.rotStartX = clientX;
    this.rotStartY = clientY;
  }

  public rotate(clientX: number, clientY: number, isGameMode: boolean = false): void {
    if (!this.isRotating) return;
    const dx = clientX - this.rotStartX;
    const dy = clientY - this.rotStartY;

    const sensitivity = CAMERA_CONFIG.rotationSensitivity * this.rotateSpeed;

    this.desiredYaw -= dx * sensitivity;

    const minP = isGameMode ? BALANCE_CONFIG.camera.gameMode.minPitch : CAMERA_CONFIG.minPitch;
    const maxP = isGameMode
      ? BALANCE_CONFIG.camera.gameMode.maxPitch
      : Math.PI / 2 - CAMERA_CONFIG.maxPitchOffset;

    this.desiredPitch = Math.max(minP, Math.min(maxP, this.desiredPitch + dy * sensitivity));

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
    const metricFactor = (0.04 / this.scale) * this.panSpeed;
    const dx = (clientX - this.panStartX) * metricFactor;
    const dy = (clientY - this.panStartY) * metricFactor;
    this.totalPanDistance += Math.hypot(dx, dy);

    // Сдвигаем точку фокуса targetX и targetZ вдоль плоскости пола XZ с учетом угла камеры
    const unRotDx = dx * Math.cos(-this.yaw) - dy * Math.sin(-this.yaw);
    const unRotDz = dx * Math.sin(-this.yaw) + dy * Math.cos(-this.yaw);

    this.targetX -= unRotDx;
    this.targetZ -= unRotDz;
    this.desiredTargetX = this.targetX;
    this.desiredTargetZ = this.targetZ;

    this.panStartX = clientX;
    this.panStartY = clientY;
  }

  public endPan(): boolean {
    const wasDragging = this.totalPanDistance > 5;
    this.isPanning = false;
    return wasDragging;
  }

  public zoomAt(
    _clientX: number,
    _clientY: number,
    deltaY: number,
    _canvas?: HTMLCanvasElement,
    isGameMode: boolean = false
  ): void {
    if (isGameMode) {
      const cfg = BALANCE_CONFIG.camera.gameMode;
      // В режиме игры мягко меняем целевую дистанцию в метрах
      const step = Math.sign(deltaY) * Math.max(1.0, Math.min(3.0, Math.abs(deltaY) * 0.02));
      this.desiredDistance = Math.max(
        cfg.minDistance,
        Math.min(cfg.maxDistance, this.desiredDistance + step)
      );
    } else {
      // В редакторе непрерывный экспоненциальный зум без дискретных скачков
      const zoomDelta = Math.max(-0.25, Math.min(0.25, -deltaY * 0.0012));
      const factor = Math.exp(zoomDelta);
      const targetScale = Math.min(
        this.maxScale,
        Math.max(this.minScale, (18.0 / this.desiredDistance) * factor)
      );
      this.desiredDistance = 18.0 / targetScale;
    }
  }

  public adjustHeight(deltaY: number): void {
    const speed = 0.5 * (1 / this.scale);
    const step = deltaY < 0 ? speed : -speed;
    this.targetY = Math.max(-50, Math.min(200, this.targetY + step));
    this.desiredTargetY = this.targetY;
  }

  public lookAt(worldX: number, worldZ: number, _canvas?: HTMLCanvasElement): void {
    this.targetX = worldX;
    this.targetZ = worldZ;
    this.desiredTargetX = worldX;
    this.desiredTargetZ = worldZ;
  }

  private savedEditorState: CameraState | null = null;

  public saveState(): void {
    this.savedEditorState = this.serialize();
  }

  public restoreState(): boolean {
    if (this.savedEditorState) {
      this.deserialize(this.savedEditorState);
      this.savedEditorState = null;
      return true;
    }
    return false;
  }

  public setDesiredTarget(x: number, y: number, z: number): void {
    this.desiredTargetX = x;
    this.desiredTargetY = y;
    this.desiredTargetZ = z;
  }

  public snapToTarget(x: number, y: number, z: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.desiredTargetX = x;
    this.desiredTargetY = y;
    this.desiredTargetZ = z;
  }

  public clampToGameBounds(): void {
    const cfg = BALANCE_CONFIG.camera.gameMode;
    this.desiredPitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, this.desiredPitch));
    this.pitch = this.desiredPitch;

    const currentDist = 18.0 / Math.max(0.01, this.scale);
    this.desiredDistance = Math.max(cfg.minDistance, Math.min(cfg.maxDistance, currentDist));
    this.scale = 18.0 / this.desiredDistance;
  }

  /**
   * Покадровое подтягивание текущих значений к целевым по закону экспоненциального затухания:
   * скорость изменения строго пропорциональна текущей разнице («чем больше разница — тем быстрее, чем меньше — тем медленнее»).
   */
  public update(dt: number, isGameMode: boolean = false): void {
    if (dt <= 0) return;

    if (isGameMode) {
      const cfg = BALANCE_CONFIG.camera.gameMode;

      // Плавное следование за головой персонажа
      const posT = 1.0 - Math.exp(-cfg.positionSmoothSpeed * dt);
      this.targetX += (this.desiredTargetX - this.targetX) * posT;
      this.targetY += (this.desiredTargetY - this.targetY) * posT;
      this.targetZ += (this.desiredTargetZ - this.targetZ) * posT;

      // Плавный поворот по кратчайшей дуге окружности
      const yawDiff = angleDifference(this.desiredYaw, this.yaw);
      const yawT = 1.0 - Math.exp(-cfg.yawSmoothSpeed * dt);
      this.yaw = normalizeAngle(this.yaw + yawDiff * yawT);
      this.desiredYaw = normalizeAngle(this.desiredYaw);

      // Плавный наклон с гарантированным соблюдением границ
      this.desiredPitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, this.desiredPitch));
      const pitchT = 1.0 - Math.exp(-cfg.pitchSmoothSpeed * dt);
      this.pitch += (this.desiredPitch - this.pitch) * pitchT;
      this.pitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, this.pitch));

      // Плавное изменение дистанции отдаления с жестким соблюдением границ [minDistance, maxDistance]
      this.desiredDistance = Math.max(
        cfg.minDistance,
        Math.min(cfg.maxDistance, this.desiredDistance)
      );
      const currentDist = 18.0 / Math.max(0.01, this.scale);
      const distT = 1.0 - Math.exp(-cfg.distanceSmoothSpeed * dt);
      const newDist = currentDist + (this.desiredDistance - currentDist) * distT;
      const clampedDist = Math.max(cfg.minDistance, Math.min(cfg.maxDistance, newDist));
      this.scale = 18.0 / Math.max(0.1, clampedDist);
    } else {
      // Во всех остальных режимах сглаживаем наклон, поворот и зум для устранения ступенчатости
      const smoothSpeed = 25.0;
      const t = 1.0 - Math.exp(-smoothSpeed * dt);

      const yawDiff = angleDifference(this.desiredYaw, this.yaw);
      this.yaw = normalizeAngle(this.yaw + yawDiff * t);
      this.desiredYaw = normalizeAngle(this.desiredYaw);

      this.pitch += (this.desiredPitch - this.pitch) * t;

      const currentDist = 18.0 / Math.max(0.01, this.scale);
      const newDist = currentDist + (this.desiredDistance - currentDist) * t;
      this.scale = 18.0 / Math.max(0.01, newDist);
    }
  }

  public reset(_canvas?: HTMLCanvasElement): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.desiredTargetX = 0;
    this.desiredTargetY = 0;
    this.desiredTargetZ = 0;

    this.scale = CAMERA_CONFIG.defaultZoom;
    this.desiredDistance = 18.0 / CAMERA_CONFIG.defaultZoom;

    this.yaw = 0;
    this.desiredYaw = 0;

    this.pitch = CAMERA_CONFIG.defaultPitch;
    this.desiredPitch = CAMERA_CONFIG.defaultPitch;
  }

  public resetZoomAndRotation(_canvas?: HTMLCanvasElement): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.desiredTargetX = 0;
    this.desiredTargetY = 0;
    this.desiredTargetZ = 0;

    this.scale = CAMERA_CONFIG.defaultZoom;
    this.desiredDistance = 18.0 / CAMERA_CONFIG.defaultZoom;

    this.yaw = 0;
    this.desiredYaw = 0;

    this.pitch = CAMERA_CONFIG.defaultPitch;
    this.desiredPitch = CAMERA_CONFIG.defaultPitch;
  }

  public serialize(): CameraState {
    return {
      scale: this.scale,
      targetX: this.targetX,
      targetY: this.targetY,
      targetZ: this.targetZ,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  public deserialize(data: Partial<CameraState>): void {
    if (typeof data.scale === 'number' && !Number.isNaN(data.scale)) {
      this.scale = Math.min(this.maxScale, Math.max(this.minScale, data.scale));
      this.desiredDistance = 18.0 / Math.max(0.01, this.scale);
    }
    if (typeof data.targetX === 'number' && !Number.isNaN(data.targetX)) {
      this.targetX = data.targetX;
      this.desiredTargetX = data.targetX;
    }
    if (typeof data.targetY === 'number' && !Number.isNaN(data.targetY)) {
      this.targetY = data.targetY;
      this.desiredTargetY = data.targetY;
    }
    if (typeof data.targetZ === 'number' && !Number.isNaN(data.targetZ)) {
      this.targetZ = data.targetZ;
      this.desiredTargetZ = data.targetZ;
    }
    if (typeof data.yaw === 'number' && !Number.isNaN(data.yaw)) {
      this.yaw = data.yaw;
      this.desiredYaw = data.yaw;
    }
    if (typeof data.pitch === 'number' && !Number.isNaN(data.pitch)) {
      this.pitch = Math.max(
        CAMERA_CONFIG.minPitch,
        Math.min(Math.PI / 2 - CAMERA_CONFIG.maxPitchOffset, data.pitch)
      );
      this.desiredPitch = this.pitch;
    }
  }
}
