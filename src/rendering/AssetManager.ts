import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export class AssetManager {
  private static instance: AssetManager;
  private loader = new GLTFLoader();
  private gltfCache = new Map<string, any>();
  private loadPromises = new Map<string, Promise<any>>();

  private constructor() {}

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  public async loadGLTF(url: string): Promise<any> {
    if (this.gltfCache.has(url)) {
      return this.gltfCache.get(url);
    }
    if (this.loadPromises.has(url)) {
      return this.loadPromises.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          this.gltfCache.set(url, gltf);
          this.loadPromises.delete(url);
          resolve(gltf);
        },
        undefined,
        (error) => {
          this.loadPromises.delete(url);
          reject(error);
        }
      );
    });

    this.loadPromises.set(url, promise);
    return promise;
  }

  /**
   * Загружает GLTF-модель и возвращает её глубокую копию с поддержкой скелетных ригов и мешей.
   */
  public async getClonedModel(url: string): Promise<THREE.Object3D | null> {
    if (url.startsWith('proc://')) {
      const { ProceduralAssetManager } = await import('./procedural/ProceduralAssetManager');
      const model = ProceduralAssetManager.getInstance().getClonedAsset(url);
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.userData.isSharedAsset = true;
          }
        });
      }
      return model;
    }

    const gltf = await this.loadGLTF(url);
    if (!gltf || !gltf.scene) return null;
    const clone = SkeletonUtils.clone(gltf.scene);

    // Защищаем общую геометрию и материалы от случайного удаления
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.isSharedAsset = true;
      }
    });

    return clone;
  }

  public clear(): void {
    for (const gltf of this.gltfCache.values()) {
      if (gltf && gltf.scene) {
        gltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m: THREE.Material) => {
                (m as any).map?.dispose();
                m.dispose();
              });
            } else if (child.material) {
              (child.material as any).map?.dispose();
              child.material.dispose();
            }
          }
        });
      }
    }
    this.gltfCache.clear();
    this.loadPromises.clear();
  }
}
