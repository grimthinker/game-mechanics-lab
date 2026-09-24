import * as THREE from 'three';
import { World } from '../../ecs/World';
import { EntityId, AnimatorComponent } from '../../ecs/types';
import { BodyStructureType } from '../../ecs/templates';
import { CREATURE_RIG_PROFILES } from '../rigProfiles';
import { AssetManager } from '../AssetManager';
import { computeLocalBox, computeDetachedLimbGrip } from '../gripCalculators';
import { attachOutlines, disposeObject } from '../renderUtils';

export interface RigAnimatorState {
  mixer: THREE.AnimationMixer;
  currentClipName: string;
  targetClipName: string;
  currentAction: THREE.AnimationAction | null;
  rig: THREE.Object3D;
  socketBones: Map<string, THREE.Object3D>;
}

export class CreatureMeshAssembler {
  constructor(
    private scene: THREE.Scene,
    private matSilhouetteOutline: THREE.Material,
    private loadingMeshes: Set<EntityId>,
    private loadingGenerations: Map<EntityId, number>,
    private onRegisterAnimator: (id: EntityId, state: RigAnimatorState) => void,
    private onPlayDefaultAnimation: (
      id: EntityId,
      animatorComp: AnimatorComponent,
      animKey: string
    ) => Promise<void>
  ) {}

  public canAssembleModularRig(world: World, id: EntityId, archetype?: string): boolean {
    const animator = world.getComponent(id, 'animator');
    if (!animator || archetype !== 'creature') return false;
    const profile = CREATURE_RIG_PROFILES[animator.rigType as BodyStructureType];
    return Boolean(profile?.rigAsset);
  }

  public createModularRig(world: World, id: EntityId): THREE.Group {
    this.loadingMeshes.add(id);
    const group = new THREE.Group();
    group.userData.entityId = id;
    group.userData.isModularRig = true;
    this.assembleModularRigAsync(id, group, world).catch(console.error);
    return group;
  }

  public canAssembleDetachedLimb(world: World, id: EntityId, archetype?: string): boolean {
    const assembly = world.getComponent(id, 'assemblyRoot');
    return Boolean(assembly && (archetype === 'item' || archetype === 'bodyPart'));
  }

  public createDetachedLimb(world: World, id: EntityId): THREE.Group {
    this.loadingMeshes.add(id);
    const group = new THREE.Group();
    group.userData.entityId = id;
    group.userData.isDetachedLimb = true;
    this.assembleDetachedLimbAsync(id, group, world).catch(console.error);
    return group;
  }

  public async assembleModularRigAsync(
    rootId: EntityId,
    parentGroup: THREE.Group,
    world: World
  ): Promise<void> {
    const animator = world.getComponent(rootId, 'animator');
    const assembly = world.getComponent(rootId, 'assemblyRoot');
    if (!animator || !assembly) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const rigProfile = CREATURE_RIG_PROFILES[animator.rigType as BodyStructureType];
    if (!rigProfile || !rigProfile.rigAsset) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const currentGen = (this.loadingGenerations.get(rootId) ?? 0) + 1;
    this.loadingGenerations.set(rootId, currentGen);

    const isAborted = () =>
      this.loadingGenerations.get(rootId) !== currentGen || !world.getEntity(rootId);

    try {
      const assetManager = AssetManager.getInstance();
      const rig = await assetManager.getClonedModel(rigProfile.rigAsset);
      if (!rig) throw new Error(`Rig ${rigProfile.rigAsset} failed to load`);

      if (isAborted()) {
        disposeObject(rig);
        disposeObject(parentGroup);
        this.scene.remove(parentGroup);
        return;
      }

      rig.scale.set(1, 1, 1);
      rig.rotation.y = Math.PI / 2;
      parentGroup.add(rig);

      const socketBones = new Map<string, THREE.Object3D>();
      rig.traverse((child) => {
        if (child.name.includes('Socket')) {
          socketBones.set(child.name, child);
        }
      });

      const mixer = new THREE.AnimationMixer(rig);
      this.onRegisterAnimator(rootId, {
        mixer,
        currentClipName: '',
        targetClipName: '',
        currentAction: null,
        rig,
        socketBones,
      });

      for (const partId of assembly.partIds) {
        const visual = world.getComponent(partId, 'visualModel');
        if (visual && visual.modelId && visual.rigNodeName) {
          const targetNode = rig.getObjectByName(visual.rigNodeName);
          if (targetNode) {
            const meshClone = await assetManager.getClonedModel(visual.modelId);

            if (isAborted()) {
              if (meshClone) disposeObject(meshClone);
              disposeObject(parentGroup);
              this.scene.remove(parentGroup);
              return;
            }

            if (meshClone) {
              meshClone.userData.partId = partId;
              meshClone.userData.entityId = partId;
              meshClone.traverse((c) => {
                c.userData.partId = partId;
                c.userData.entityId = partId;
              });

              if (meshClone.type === 'Scene' || meshClone.type === 'Group') {
                targetNode.add(...meshClone.children);
              } else {
                targetNode.add(meshClone);
              }
            }
          }
        }
      }

      attachOutlines(parentGroup, this.matSilhouetteOutline);

      const box = computeLocalBox(rig);
      const visualCorrectionY = -box.min.y;
      rig.position.set(0, visualCorrectionY, 0);

      this.onPlayDefaultAnimation(rootId, animator, 'stand_idle').catch(console.error);
    } catch (err) {
      console.error(`[CreatureMeshAssembler] Error assembling rig for ${rootId}:`, err);
    } finally {
      if (this.loadingGenerations.get(rootId) === currentGen) {
        this.loadingMeshes.delete(rootId);
      }
    }
  }

  public async assembleDetachedLimbAsync(
    rootId: EntityId,
    parentGroup: THREE.Group,
    world: World
  ): Promise<void> {
    const assembly = world.getComponent(rootId, 'assemblyRoot');
    const visual = world.getComponent(rootId, 'visualModel');
    if (!assembly || !assembly.partIds || assembly.partIds.length === 0) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const currentGen = (this.loadingGenerations.get(rootId) ?? 0) + 1;
    this.loadingGenerations.set(rootId, currentGen);

    const isAborted = () =>
      this.loadingGenerations.get(rootId) !== currentGen || !world.getEntity(rootId);

    try {
      const assetManager = AssetManager.getInstance();
      const rigStructure = (visual?.rigType as BodyStructureType) || 'humanoid';
      const rigProfile = CREATURE_RIG_PROFILES[rigStructure] || CREATURE_RIG_PROFILES.humanoid;
      const rigAsset = rigProfile?.rigAsset;

      if (!rigAsset) {
        throw new Error(`Rig asset not found for structure: ${rigStructure}`);
      }

      const rig = await assetManager.getClonedModel(rigAsset);
      if (!rig) throw new Error(`Rig ${rigAsset} failed to load for detached limb`);

      if (isAborted()) {
        disposeObject(rig);
        disposeObject(parentGroup);
        this.scene.remove(parentGroup);
        return;
      }

      rig.scale.set(1, 1, 1);
      rig.rotation.y = Math.PI / 2;

      rig.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = false;
        }
      });

      for (const partId of assembly.partIds) {
        const partVisual = world.getComponent(partId, 'visualModel');
        if (partVisual && partVisual.modelId && partVisual.rigNodeName) {
          const targetNode = rig.getObjectByName(partVisual.rigNodeName);
          if (targetNode) {
            const meshClone = await assetManager.getClonedModel(partVisual.modelId);

            if (isAborted()) {
              if (meshClone) disposeObject(meshClone);
              disposeObject(rig);
              disposeObject(parentGroup);
              this.scene.remove(parentGroup);
              return;
            }

            if (meshClone) {
              meshClone.userData.entityId = rootId;
              delete meshClone.userData.partId;

              meshClone.traverse((c) => {
                c.userData.entityId = rootId;
                delete c.userData.partId;
              });

              const childrenToAttach = [...meshClone.children];
              if (childrenToAttach.length > 0) {
                for (const child of childrenToAttach) {
                  targetNode.add(child);
                }
              } else {
                targetNode.add(meshClone);
              }
            }
          }
        }
      }

      const limbBox = computeLocalBox(rig);
      const boxCenter = new THREE.Vector3();

      if (!limbBox.isEmpty()) {
        limbBox.getCenter(boxCenter);
        rig.position.sub(boxCenter);
      }

      parentGroup.add(rig);

      const anchorPartId = assembly.rootPartId;
      const anchorTag = world.getComponent(anchorPartId, 'tag');
      const subType = anchorTag?.subType;

      parentGroup.userData.gripTransform = computeDetachedLimbGrip(parentGroup, subType);

      attachOutlines(parentGroup, this.matSilhouetteOutline);
    } catch (err) {
      console.error(`[CreatureMeshAssembler] Error assembling detached limb ${rootId}:`, err);
    } finally {
      if (this.loadingGenerations.get(rootId) === currentGen) {
        this.loadingMeshes.delete(rootId);
      }
    }
  }
}
