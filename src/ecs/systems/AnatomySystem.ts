import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import {
  EntityId,
  CollisionCategory,
  COLLISION_MASK_ALL,
  RENDER_Z_INDEX,
  EntityConfig,
} from '../types';
import {
  traverseAnatomyGraph,
  calculateSystemWeightAndRadius,
  findActiveBrain,
} from '../utils/anatomy';
import { destroyPartRecursive } from '../utils/anatomyDamage';
import { ARCHETYPE_ASSEMBLERS } from '../archetypes';
import { setBaseStat, createStat } from '../stats/StatEvaluator';
import { evaluateConsciousness, getLocomotionState, getSensoryStats } from '../utils/anatomyStatus';
import { ConsciousnessState } from '../types';

export class AnatomySystem {
  public update(_dt: number, world: World, physics: PhysicsSystem): void {
    // 0. Удаление частей тела, у которых структурная прочность (СП) упала до 0
    const destructibleParts = world.getEntitiesWith('socketDef', 'health');
    for (const [partId, { health }] of destructibleParts) {
      if (health.current <= 0) {
        destroyPartRecursive(world, physics, partId);
      }
    }

    // 1. Поиск всех изолированных подграфов соединенных частей тела
    const bodyParts = world.getEntitiesWith('socketDef');
    const visitedParts = new Set<EntityId>();
    const subgraphs: EntityId[][] = [];

    for (const [partId] of bodyParts) {
      if (visitedParts.has(partId)) continue;
      const graph = traverseAnatomyGraph(world, partId);
      for (const id of graph) visitedParts.add(id);
      subgraphs.push(graph);
    }

    // 2. Сбор существующих корней существ для разрешения преемственности
    const existingCreatureRoots = world.getEntitiesWith('assemblyRoot').filter(([id]) => {
      const tag = world.getComponent(id, 'tag');
      return tag?.archetype === 'creature';
    });

    const claimedCreatureRootIds = new Set<string>();

    interface ViableCreaturePlan {
      graph: EntityId[];
      anchorId: EntityId;
      totalWeight: number;
      maxRadius: number;
      targetRootId: string;
      isNewRoot: boolean;
      inheritedBehavior?: string;
      inheritedName?: string;
    }

    interface NonViableItemPlan {
      graph: EntityId[];
      totalWeight: number;
      maxRadius: number;
      calculatedSize: number;
    }

    const viablePlans: ViableCreaturePlan[] = [];
    const itemPlans: NonViableItemPlan[] = [];

    // 3. Арбитраж подграфов: сопоставление с существующими корнями
    for (const graph of subgraphs) {
      const brainId = findActiveBrain(world, graph[0]);
      const heartId = graph.find((id) => world.getComponent(id, 'heart') !== undefined);
      const consciousness = evaluateConsciousness(world, graph[0]);
      const isViable = heartId !== undefined && consciousness !== ConsciousnessState.DEAD;

      const { totalWeight, maxRadius } = calculateSystemWeightAndRadius(world, graph[0]);

      if (isViable) {
        const anchorId = brainId ?? heartId!;

        let matchedRootId: string | null = null;

        for (const [rootId, comp] of existingCreatureRoots) {
          if (!claimedCreatureRootIds.has(rootId) && graph.includes(comp.assemblyRoot.rootPartId)) {
            matchedRootId = rootId;
            break;
          }
        }

        if (!matchedRootId) {
          for (const partId of graph) {
            const brain = world.getComponent(partId, 'bodyBrain');
            if (brain && brain.rootEntityId && !claimedCreatureRootIds.has(brain.rootEntityId)) {
              const rootTag = world.getComponent(brain.rootEntityId, 'tag');
              if (rootTag?.archetype === 'creature') {
                matchedRootId = brain.rootEntityId;
                break;
              }
            }
          }
        }

        if (!matchedRootId) {
          for (const [rootId, comp] of existingCreatureRoots) {
            if (
              !claimedCreatureRootIds.has(rootId) &&
              comp.assemblyRoot.partIds?.some((pId) => graph.includes(pId))
            ) {
              matchedRootId = rootId;
              break;
            }
          }
        }

        if (matchedRootId) {
          claimedCreatureRootIds.add(matchedRootId);
          viablePlans.push({
            graph,
            anchorId,
            totalWeight,
            maxRadius,
            targetRootId: matchedRootId,
            isNewRoot: false,
          });
        } else {
          let inheritedBehavior = 'IdleTree';
          let inheritedName = 'Существо';

          for (const [rootId, comp] of existingCreatureRoots) {
            if (comp.assemblyRoot.partIds?.some((pId) => graph.includes(pId))) {
              const oldAi = world.getComponent(rootId, 'aiStats');
              const oldMeta = world.getComponent(rootId, 'meta');
              if (oldAi) inheritedBehavior = oldAi.behavior.current;
              if (oldMeta) inheritedName = `${oldMeta.name} (Фрагмент)`;
              break;
            }
          }

          const newRootId = `creature_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          viablePlans.push({
            graph,
            anchorId,
            totalWeight,
            maxRadius,
            targetRootId: newRootId,
            isNewRoot: true,
            inheritedBehavior,
            inheritedName,
          });
        }
      } else {
        let sumSqSize = 0;
        for (const id of graph) {
          const pStats = world.getComponent(id, 'physicsStats');
          const partSize = pStats?.size ?? 10;
          sumSqSize += partSize * partSize;
        }
        const calculatedSize = Math.max(1, Math.round(Math.sqrt(sumSqSize)));

        itemPlans.push({
          graph,
          totalWeight,
          maxRadius,
          calculatedSize,
        });
      }
    }

    for (const [rootId] of existingCreatureRoots) {
      if (!claimedCreatureRootIds.has(rootId)) {
        const phys = world.getComponent(rootId, 'physicsBody');
        if (phys?.rawBody) {
          physics.driver?.removeRigidBody(phys.rawBody);
        }
        world.removeEntity(rootId);
      }
    }

    for (const plan of viablePlans) {
      this.applyCreaturePlan(world, physics, plan);
    }

    for (const plan of itemPlans) {
      this.applyItemPlan(world, physics, plan);
    }
  }

  private applyCreaturePlan(
    world: World,
    physics: PhysicsSystem,
    plan: {
      graph: EntityId[];
      anchorId: EntityId;
      totalWeight: number;
      maxRadius: number;
      targetRootId: string;
      isNewRoot: boolean;
      inheritedBehavior?: string;
      inheritedName?: string;
    }
  ): void {
    const rootId = plan.targetRootId;
    const anchorTransform = world.getComponent(plan.anchorId, 'transform') ?? {
      x: 0,
      y: 0,
      z: 0,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angle: 0,
    };

    if (plan.isNewRoot) {
      world.createEntity(rootId);
      const rootConfig: EntityConfig = {
        ai: { behavior: plan.inheritedBehavior || 'IdleTree' },
        meta: { name: plan.inheritedName || 'Существо', entityType: 'creature' },
      };
      ARCHETYPE_ASSEMBLERS.creature(world, physics, null as any, rootId, rootConfig, {
        x: anchorTransform.x,
        y: anchorTransform.y,
      });
    }

    world.addComponent(rootId, 'assemblyRoot', { rootPartId: plan.anchorId, partIds: plan.graph });
    world.removeComponent(rootId, 'item');

    for (const partId of plan.graph) {
      const brainComp = world.getComponent(partId, 'bodyBrain');
      if (brainComp) {
        brainComp.rootEntityId = rootId;
      }
    }

    const sensory = getSensoryStats(world, rootId);
    let perception = world.getComponent(rootId, 'perception');
    if (!perception) {
      world.addComponent(rootId, 'perception', {
        visionFovAngle: sensory.vision.fovAngle,
        visionClarity: sensory.vision.clarity,
        visionMaxDistance: sensory.vision.maxDistance,
        hearingSensitivity: sensory.hearing.sensitivity,
        hearingMaxDistance: sensory.hearing.maxDistance,
      });
    } else {
      perception.visionFovAngle = sensory.vision.fovAngle;
      perception.visionClarity = sensory.vision.clarity;
      perception.visionMaxDistance = sensory.vision.maxDistance;
      perception.hearingSensitivity = sensory.hearing.sensitivity;
      perception.hearingMaxDistance = sensory.hearing.maxDistance;
    }

    const currentConsciousness = evaluateConsciousness(world, rootId);
    let consciousnessComp = world.getComponent(rootId, 'consciousness');
    if (!consciousnessComp) {
      world.addComponent(rootId, 'consciousness', { state: currentConsciousness });
    } else {
      consciousnessComp.state = currentConsciousness;
    }

    const currentLocomotion = getLocomotionState(world, rootId);
    let locomotionComp = world.getComponent(rootId, 'locomotionState');
    if (!locomotionComp) {
      world.addComponent(rootId, 'locomotionState', { ...currentLocomotion });
    } else {
      Object.assign(locomotionComp, currentLocomotion);
    }

    let rootPhysStats = world.getComponent(rootId, 'physicsStats');
    if (!rootPhysStats) {
      world.addComponent(rootId, 'physicsStats', {
        radius: createStat(plan.maxRadius),
        weight: createStat(plan.totalWeight),
        isSolid: true,
      });
      rootPhysStats = world.getComponent(rootId, 'physicsStats')!;
    } else {
      setBaseStat(rootPhysStats.radius, plan.maxRadius);
      setBaseStat(rootPhysStats.weight, plan.totalWeight);
    }

    let rootPhysBody = world.getComponent(rootId, 'physicsBody');
    const rootTransform = world.getComponent(rootId, 'transform') ?? anchorTransform;

    let rawBody = rootPhysBody?.rawBody;
    let rawCollider = rootPhysBody?.rawCollider;

    if (!rawBody && physics.driver && physics.driver.isReady) {
      rawBody = physics.driver.createKinematicPositionBody(
        { x: rootTransform.x, y: rootTransform.y, z: rootTransform.z },
        rootId
      );
      const radius = plan.maxRadius;
      const halfHeight = Math.max(0.01, (1.8 - 2 * radius) / 2);
      const offsetY = halfHeight + radius;
      rawCollider = physics.driver.createCapsuleCollider(
        halfHeight,
        radius,
        rawBody,
        plan.totalWeight,
        offsetY
      );
    }

    if (!rootPhysBody) {
      world.addComponent(rootId, 'physicsBody', {
        rawBody,
        rawCollider,
        bodyType: 'kinematicPositionBased',
        isStatic: false,
        category: CollisionCategory.CREATURE,
        mask: COLLISION_MASK_ALL,
        currentColliderStance: 'standing',
      });
    } else {
      rootPhysBody.rawBody = rawBody;
      rootPhysBody.rawCollider = rawCollider;
      rootPhysBody.bodyType = 'kinematicPositionBased';
      rootPhysBody.currentColliderStance = 'standing';
    }

    if (!currentLocomotion.canStand) {
      const input = world.getComponent(rootId, 'input');
      if (input) {
        input.desiredStance = 'prone';
      }
    }

    for (const partId of plan.graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootTransform.x;
        partTransform.y = rootTransform.y;
        partTransform.z = rootTransform.z;
        partTransform.rotation = { ...rootTransform.rotation };
        partTransform.angle = rootTransform.angle;
      }
      const physBody = world.getComponent(partId, 'physicsBody');
      if (physBody) {
        if (physBody.rawBody) physics.driver?.removeRigidBody(physBody.rawBody);
        world.removeComponent(partId, 'physicsBody');
      }
      world.removeComponent(partId, 'item');
    }
  }

  private applyItemPlan(
    world: World,
    physics: PhysicsSystem,
    plan: {
      graph: EntityId[];
      totalWeight: number;
      maxRadius: number;
      calculatedSize: number;
    }
  ): void {
    let anchorPartId = plan.graph[0];
    let maxLinks = -1;
    for (const id of plan.graph) {
      const linkComp = world.getComponent(id, 'socketLink');
      const linksCount = linkComp ? Object.keys(linkComp.links).length : 0;
      if (linksCount > maxLinks) {
        maxLinks = linksCount;
        anchorPartId = id;
      } else if (linksCount === maxLinks && linksCount > -1) {
        const currentSize = world.getComponent(id, 'physicsStats')?.size ?? 0;
        const anchorSize = world.getComponent(anchorPartId, 'physicsStats')?.size ?? 0;
        if (currentSize > anchorSize) {
          anchorPartId = id;
        }
      }
    }

    const assemblyRoots = world.getEntitiesWith('assemblyRoot');
    let rootItemId = assemblyRoots.find(([id, comp]) => {
      const isItem = world.getComponent(id, 'tag')?.archetype === 'item';
      return isItem && plan.graph.includes(comp.assemblyRoot.rootPartId);
    })?.[0];

    const anchorTransform = world.getComponent(anchorPartId, 'transform') ?? {
      x: 0,
      y: 0,
      z: 0,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angle: 0,
    };

    if (!rootItemId || !world.getEntity(rootItemId)) {
      rootItemId = `item_assembly_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      world.createEntity(rootItemId);
      world.addComponent(rootItemId, 'transform', {
        x: anchorTransform.x,
        y: anchorTransform.y,
        z: anchorTransform.z,
        rotation: { ...anchorTransform.rotation },
        angle: anchorTransform.angle,
      });
    }

    world.addComponent(rootItemId, 'tag', { archetype: 'item', subType: 'bodyPart' });
    world.addComponent(rootItemId, 'meta', { name: 'Часть тела', entityType: 'item' });
    world.addComponent(rootItemId, 'assemblyRoot', {
      rootPartId: anchorPartId,
      partIds: plan.graph,
    });

    let itemComp = world.getComponent(rootItemId, 'item');
    if (!itemComp) {
      world.addComponent(rootItemId, 'item', {
        name: 'Часть тела',
        type: 'bodyPart',
        maxStack: 1,
        count: 1,
        size: plan.calculatedSize,
        equipTypes: [],
        equippable: false,
        equipTimeMultiplier: 1.0,
      });
    } else {
      itemComp.size = plan.calculatedSize;
    }

    let rootPhysStats = world.getComponent(rootItemId, 'physicsStats');
    if (!rootPhysStats) {
      world.addComponent(rootItemId, 'physicsStats', {
        radius: createStat(plan.maxRadius),
        weight: createStat(plan.totalWeight),
        size: plan.calculatedSize,
        isSolid: true,
      });
      rootPhysStats = world.getComponent(rootItemId, 'physicsStats')!;
    } else {
      setBaseStat(rootPhysStats.radius, plan.maxRadius);
      setBaseStat(rootPhysStats.weight, plan.totalWeight);
      rootPhysStats.size = plan.calculatedSize;
    }

    const rootItemTransform = world.getComponent(rootItemId, 'transform') ?? anchorTransform;
    const ownership = world.getComponent(rootItemId, 'ownership');

    if (!ownership) {
      let rootPhysBody = world.getComponent(rootItemId, 'physicsBody');
      let rawBody = rootPhysBody?.rawBody;
      let rawCollider = rootPhysBody?.rawCollider;

      if (!rawBody && physics.driver && physics.driver.isReady) {
        rawBody = physics.driver.createDynamicBody(
          { x: rootItemTransform.x, y: rootItemTransform.y + 0.5, z: rootItemTransform.z },
          rootItemId
        );
        const size = plan.maxRadius * 0.8;
        rawCollider = physics.driver.createCuboidCollider(
          size / 2,
          size / 2,
          size / 2,
          rawBody,
          plan.totalWeight
        );
        rawCollider.setRestitution(0.3);
        rawBody.setLinearDamping(0.95);
        rawBody.setAngularDamping(0.95);
      }

      if (!rootPhysBody) {
        world.addComponent(rootItemId, 'physicsBody', {
          rawBody,
          rawCollider,
          bodyType: 'dynamic',
          isStatic: false,
          category: CollisionCategory.ITEM,
          mask: COLLISION_MASK_ALL,
        });
      } else {
        rootPhysBody.rawBody = rawBody;
        rootPhysBody.rawCollider = rawCollider;
        rootPhysBody.bodyType = 'dynamic';
      }

      let renderable = world.getComponent(rootItemId, 'renderable');
      if (!renderable) {
        world.addComponent(rootItemId, 'renderable', {
          zIndex: RENDER_Z_INDEX.ITEMS,
          isVisible: true,
          syncWithTransform: true,
        });
      } else {
        renderable.isVisible = true;
      }
    } else {
      const physBody = world.getComponent(rootItemId, 'physicsBody');
      if (physBody) {
        if (physBody.rawBody) physics.driver?.removeRigidBody(physBody.rawBody);
        world.removeComponent(rootItemId, 'physicsBody');
      }
      const renderable = world.getComponent(rootItemId, 'renderable');
      if (renderable) {
        renderable.isVisible = false;
      }
    }

    for (const partId of plan.graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootItemTransform.x;
        partTransform.y = rootItemTransform.y;
        partTransform.z = rootItemTransform.z;
        partTransform.rotation = { ...rootItemTransform.rotation };
        partTransform.angle = rootItemTransform.angle;
      }
      const brainComp = world.getComponent(partId, 'bodyBrain');
      if (brainComp) {
        delete brainComp.rootEntityId;
      }
      const physBody = world.getComponent(partId, 'physicsBody');
      if (physBody) {
        if (physBody.rawBody) physics.driver?.removeRigidBody(physBody.rawBody);
        world.removeComponent(partId, 'physicsBody');
      }
      world.removeComponent(partId, 'item');
      world.removeComponent(partId, 'renderable');
    }
  }
}
