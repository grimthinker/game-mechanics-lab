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
import { Circle } from 'detect-collisions';
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

        // Приоритет 1: Подграф, содержащий оригинальный rootPartId из assemblyRoot
        for (const [rootId, comp] of existingCreatureRoots) {
          if (!claimedCreatureRootIds.has(rootId) && graph.includes(comp.assemblyRoot.rootPartId)) {
            matchedRootId = rootId;
            break;
          }
        }

        // Приоритет 2: Части тела подграфа прямо ссылаются на корень через bodyBrain.rootEntityId
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

        // Приоритет 3: Если исходный якорь погиб, корень наследует подграф, имеющий пересечение по частям
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
          // Разделение топологии (Topology Split): жизнеспособный фрагмент отделился от основного тела
          let inheritedBehavior = 'IdleTree';
          let inheritedName = 'Существо';

          // Наследуем имя и поведение от прародителя, если возможно
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
        // Нежизнеспособный подграф (оторванная конечность или мертвое мясо)
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

    // 4. Очистка старых корней существ, которые не были востребованы ни одним жизнеспособным подграфом
    for (const [rootId] of existingCreatureRoots) {
      if (!claimedCreatureRootIds.has(rootId)) {
        const phys = world.getComponent(rootId, 'physicsBody');
        if (phys) physics.unregisterBody(phys.body);
        world.removeEntity(rootId);
      }
    }

    // 5. Применение планов для живых существ
    for (const plan of viablePlans) {
      this.applyCreaturePlan(world, physics, plan);
    }

    // 6. Применение планов для предметов плоти
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

      world.addComponent(rootId, 'renderable', {
        zIndex: 40,
        isVisible: true,
        syncWithTransform: true,
        primitives: [
          {
            kind: 'circle',
            radius: plan.maxRadius,
            fill: '#34495e',
            stroke: plan.inheritedBehavior === 'PlayerTree' ? '#2980b9' : '#c0392b',
            strokeWidth: 2,
          },
          {
            kind: 'polygon',
            points: [
              { x: plan.maxRadius, y: 0 },
              { x: 0, y: -plan.maxRadius },
              { x: 0, y: plan.maxRadius },
            ],
            fill: '#7f8c8d',
            stroke: '#95a5a6',
            strokeWidth: 1.5,
          },
        ],
      });
    }

    // Регистрируем/обновляем актуальную анатомическую сборку
    const assembly = world.getComponent(rootId, 'assemblyRoot');
    if (!assembly) {
      world.addComponent(rootId, 'assemblyRoot', {
        rootPartId: plan.anchorId,
        partIds: plan.graph,
      });
    } else {
      assembly.rootPartId = plan.anchorId;
      assembly.partIds = plan.graph;
    }

    if (world.getComponent(rootId, 'item')) {
      world.removeComponent(rootId, 'item');
    }

    // Привязываем все мозги подграфа к новому/актуальному корню
    for (const partId of plan.graph) {
      const brainComp = world.getComponent(partId, 'bodyBrain');
      if (brainComp && brainComp.rootEntityId !== rootId) {
        brainComp.rootEntityId = rootId;
      }
    }

    // Агрегация органов чувств
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
      if (
        perception.visionFovAngle !== sensory.vision.fovAngle ||
        perception.visionClarity !== sensory.vision.clarity ||
        perception.visionMaxDistance !== sensory.vision.maxDistance ||
        perception.hearingSensitivity !== sensory.hearing.sensitivity ||
        perception.hearingMaxDistance !== sensory.hearing.maxDistance
      ) {
        perception.visionFovAngle = sensory.vision.fovAngle;
        perception.visionClarity = sensory.vision.clarity;
        perception.visionMaxDistance = sensory.vision.maxDistance;
        perception.hearingSensitivity = sensory.hearing.sensitivity;
        perception.hearingMaxDistance = sensory.hearing.maxDistance;
      }
    }

    // Агрегация локомоции и сознания
    const currentConsciousness = evaluateConsciousness(world, rootId);
    let consciousnessComp = world.getComponent(rootId, 'consciousness');
    if (!consciousnessComp) {
      world.addComponent(rootId, 'consciousness', { state: currentConsciousness });
    } else if (consciousnessComp.state !== currentConsciousness) {
      consciousnessComp.state = currentConsciousness;
    }

    const currentLocomotion = getLocomotionState(world, rootId);
    let locomotionComp = world.getComponent(rootId, 'locomotionState');
    if (!locomotionComp) {
      world.addComponent(rootId, 'locomotionState', { ...currentLocomotion });
    } else {
      Object.assign(locomotionComp, currentLocomotion);
    }

    // Агрегация физических свойств
    let rootPhysStats = world.getComponent(rootId, 'physicsStats');
    if (!rootPhysStats) {
      world.addComponent(rootId, 'physicsStats', {
        radius: createStat(plan.maxRadius),
        weight: createStat(plan.totalWeight),
        isSolid: true,
      });
      rootPhysStats = world.getComponent(rootId, 'physicsStats')!;
    } else {
      if (rootPhysStats.radius.base !== plan.maxRadius) {
        setBaseStat(rootPhysStats.radius, plan.maxRadius);
      }
      if (rootPhysStats.weight.base !== plan.totalWeight) {
        setBaseStat(rootPhysStats.weight, plan.totalWeight);
      }
    }

    let rootPhysBody = world.getComponent(rootId, 'physicsBody');
    const rootTransform = world.getComponent(rootId, 'transform') ?? anchorTransform;

    if (!rootPhysBody) {
      const body = new Circle(
        { x: rootTransform.x, y: rootTransform.y },
        Math.max(1, plan.maxRadius)
      );
      body.isStatic = false;
      world.addComponent(rootId, 'physicsBody', {
        body,
        isStatic: false,
        category: CollisionCategory.CREATURE,
        mask: COLLISION_MASK_ALL,
      });
      physics.registerBody(rootId, body);
    } else if (rootPhysBody.body instanceof Circle) {
      if (rootPhysBody.body.r !== Math.max(1, plan.maxRadius)) {
        rootPhysBody.body.r = Math.max(1, plan.maxRadius);
      }
      rootPhysBody.category = CollisionCategory.CREATURE;
    }

    if (!currentLocomotion.canStand) {
      const input = world.getComponent(rootId, 'input');
      if (input && input.desiredStance !== 'prone') {
        input.desiredStance = 'prone';
      }
    }

    // Синхронизация: части тела следуют за корнем
    for (const partId of plan.graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootTransform.x;
        partTransform.y = rootTransform.y;
        partTransform.angle = rootTransform.angle;
      }
      const physBody = world.getComponent(partId, 'physicsBody');
      if (physBody) {
        physics.unregisterBody(physBody.body);
        world.removeComponent(partId, 'physicsBody');
      }
      if (world.getComponent(partId, 'item')) {
        world.removeComponent(partId, 'item');
      }
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
    // Центральная часть куска мяса/конечности
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

    // Ищем существующую сборку-предмет, если этот кусок уже лежал на земле
    const assemblyRoots = world.getEntitiesWith('assemblyRoot');
    let rootItemId = assemblyRoots.find(([id, comp]) => {
      const isItem = world.getComponent(id, 'tag')?.archetype === 'item';
      return isItem && plan.graph.includes(comp.assemblyRoot.rootPartId);
    })?.[0];

    const anchorTransform = world.getComponent(anchorPartId, 'transform') ?? {
      x: 0,
      y: 0,
      angle: 0,
    };

    if (!rootItemId || !world.getEntity(rootItemId)) {
      rootItemId = `item_assembly_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      world.createEntity(rootItemId);
      world.addComponent(rootItemId, 'transform', {
        x: anchorTransform.x,
        y: anchorTransform.y,
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
      let physBody = world.getComponent(rootItemId, 'physicsBody');
      if (!physBody) {
        const body = new Circle(
          { x: rootItemTransform.x, y: rootItemTransform.y },
          Math.max(1, plan.maxRadius)
        );
        body.isStatic = false;
        world.addComponent(rootItemId, 'physicsBody', {
          body,
          isStatic: false,
          category: CollisionCategory.ITEM,
          mask: COLLISION_MASK_ALL,
        });
        physics.registerBody(rootItemId, body);
      } else if (physBody.body instanceof Circle) {
        physBody.body.r = Math.max(1, plan.maxRadius);
        physBody.category = CollisionCategory.ITEM;
      }

      let renderable = world.getComponent(rootItemId, 'renderable');
      const boxSize = plan.maxRadius * 1.6;
      if (!renderable) {
        world.addComponent(rootItemId, 'renderable', {
          zIndex: RENDER_Z_INDEX.ITEMS,
          isVisible: true,
          syncWithTransform: true,
          primitives: [{ kind: 'rect', width: boxSize, height: boxSize, fill: '#e67e22' }],
        });
      } else {
        renderable.isVisible = true;
        if (renderable.primitives[0] && renderable.primitives[0].kind === 'rect') {
          renderable.primitives[0].width = boxSize;
          renderable.primitives[0].height = boxSize;
        }
      }
    } else {
      const physBody = world.getComponent(rootItemId, 'physicsBody');
      if (physBody) {
        physics.unregisterBody(physBody.body);
        world.removeComponent(rootItemId, 'physicsBody');
      }
      const renderable = world.getComponent(rootItemId, 'renderable');
      if (renderable) {
        renderable.isVisible = false;
      }
    }

    // Синхронизируем положение частей и очищаем ссылки на мозг старого существа
    for (const partId of plan.graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootItemTransform.x;
        partTransform.y = rootItemTransform.y;
        partTransform.angle = rootItemTransform.angle;
      }
      const brainComp = world.getComponent(partId, 'bodyBrain');
      if (brainComp) {
        delete brainComp.rootEntityId;
      }
      const physBody = world.getComponent(partId, 'physicsBody');
      if (physBody) {
        physics.unregisterBody(physBody.body);
        world.removeComponent(partId, 'physicsBody');
      }
      world.removeComponent(partId, 'item');
      world.removeComponent(partId, 'renderable');
    }
  }
}
