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
    const gltf = await this.loadGLTF(url);
    if (!gltf || !gltf.scene) return null;
    return SkeletonUtils.clone(gltf.scene);
  }
}
