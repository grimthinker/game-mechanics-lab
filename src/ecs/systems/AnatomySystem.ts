import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { EntityId, CollisionCategory, COLLISION_MASK_ALL, RENDER_Z_INDEX } from '../types';
import {
  traverseAnatomyGraph,
  calculateSystemWeightAndRadius,
  findActiveBrain,
} from '../utils/anatomy';
import { destroyPartRecursive } from '../utils/anatomyDamage';
import { Circle } from 'detect-collisions';
import { setBaseStat, createStat } from '../stats/StatEvaluator';
import {
  evaluateConsciousness,
  ConsciousnessState,
  getLocomotionState,
  getSensoryStats,
} from '../utils/anatomyStatus';

export class AnatomySystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    // 0. Удаление частей тела, у которых структурная прочность (СП) упала до 0
    const destructibleParts = world.getEntitiesWith('socketDef', 'health');
    for (const [partId, { health }] of destructibleParts) {
      if (health.current <= 0) {
        destroyPartRecursive(world, physics, partId);
      }
    }

    const bodyParts = world.getEntitiesWith('socketDef');
    const visitedGraphs = new Set<EntityId>();

    for (const [partId] of bodyParts) {
      if (visitedGraphs.has(partId)) continue;

      // 1. Получаем весь связанный граф частей тела
      const graph = traverseAnatomyGraph(world, partId);
      graph.forEach((id) => visitedGraphs.add(id));

      // 2. Ищем активные органы и проверяем жизнеспособность
      const brainId = findActiveBrain(world, partId);
      const heartId = graph.find((id) => world.getComponent(id, 'heart') !== undefined);
      const { totalWeight, maxRadius } = calculateSystemWeightAndRadius(world, partId);

      // 3. Вычисляем суммарный габарит связки как корень из суммы квадратов размеров всех частей
      let sumSqSize = 0;
      for (const id of graph) {
        const pStats = world.getComponent(id, 'physicsStats');
        const partSize = pStats?.size ?? 10;
        sumSqSize += partSize * partSize;
      }
      const calculatedSize = Math.max(1, Math.round(Math.sqrt(sumSqSize)));

      // 4. Проверяем жизнеспособность: существо ОБЯЗАНО иметь сердце и не быть мертвым
      const consciousness = evaluateConsciousness(world, partId);
      const isViableCreature = heartId !== undefined && consciousness !== ConsciousnessState.DEAD;

      if (isViableCreature) {
        const anchorId = brainId ?? heartId!;
        this.handleCreatureGraph(world, physics, graph, anchorId, totalWeight, maxRadius);
      } else {
        this.handleItemGraph(world, physics, graph, totalWeight, maxRadius, calculatedSize);
      }
    }
  }

  private handleCreatureGraph(
    world: World,
    physics: PhysicsSystem,
    graph: EntityId[],
    anchorId: EntityId,
    totalWeight: number,
    maxRadius: number
  ): void {
    const brain = world.getComponent(anchorId, 'bodyBrain');
    let rootId = brain?.rootEntityId;

    // Если у якоря нет корня — ищем существующий корень существа
    if (!rootId || !world.getEntity(rootId)) {
      const existingRoot = world.getEntitiesWith('assemblyRoot').find(([id, comp]) => {
        const tag = world.getComponent(id, 'tag');
        return (
          tag?.archetype === 'creature' &&
          comp.assemblyRoot.partIds?.some((pId) => graph.includes(pId))
        );
      });

      if (existingRoot) {
        rootId = existingRoot[0];
      } else {
        rootId = `creature_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        world.createEntity(rootId);
        if (!world.getComponent(rootId, 'transform'))
          world.addComponent(rootId, 'transform', { x: 0, y: 0, angle: 0 });
        if (!world.getComponent(rootId, 'input'))
          world.addComponent(rootId, 'input', {
            desiredMoveVector: null,
            turnDirection: 0,
            turnRatio: 0,
            isMovingForward: false,
            isRunning: false,
            isCrouching: false,
            isSlowWalking: false,
            wantsAttack: false,
            desiredStance: 'standing',
          });
      }

      if (brain) {
        brain.rootEntityId = rootId;
      }
    }

    // Регистрируем связку анатомии на Корне
    world.addComponent(rootId, 'assemblyRoot', { rootPartId: anchorId, partIds: graph });
    world.removeComponent(rootId, 'item'); // Корень существа — не предмет

    // 0.5. Агрегация органов чувств в PerceptionComponent
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

    // 1. Агрегация физических свойств в Root
    let rootPhysStats = world.getComponent(rootId, 'physicsStats');
    if (!rootPhysStats) {
      world.addComponent(rootId, 'physicsStats', {
        radius: createStat(maxRadius),
        weight: createStat(totalWeight),
        isSolid: true,
      });
      rootPhysStats = world.getComponent(rootId, 'physicsStats')!;
    } else {
      setBaseStat(rootPhysStats.radius, maxRadius);
      setBaseStat(rootPhysStats.weight, totalWeight);
    }

    let rootPhysBody = world.getComponent(rootId, 'physicsBody');
    const rootTransform = world.getComponent(rootId, 'transform') ?? { x: 0, y: 0, angle: 0 };
    if (!rootPhysBody) {
      const body = new Circle({ x: rootTransform.x, y: rootTransform.y }, Math.max(1, maxRadius));
      body.isStatic = false;
      world.addComponent(rootId, 'physicsBody', {
        body,
        isStatic: false,
        category: CollisionCategory.CREATURE,
        mask: COLLISION_MASK_ALL,
      });
      physics.registerBody(rootId, body);
    } else if (rootPhysBody.body instanceof Circle) {
      rootPhysBody.body.r = Math.max(1, maxRadius);
      rootPhysBody.category = CollisionCategory.CREATURE;
    }

    // 2. Логика ног: если стоять невозможно (0 целых ног) — принудительный prone
    const locomotion = getLocomotionState(world, rootId);
    if (!locomotion.canStand) {
      const input = world.getComponent(rootId, 'input');
      if (input) {
        input.desiredStance = 'prone';
      }
    }

    // 3. Синхронизация: части тела следуют за корнем и не имеют своих коллайдеров/предметов
    for (const partId of graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootTransform.x;
        partTransform.y = rootTransform.y;
        partTransform.angle = rootTransform.angle;
      }
      // Очищаем физику и свойства предметов с самих частей тела (они внутри существа)
      const physBody = world.getComponent(partId, 'physicsBody');
      if (physBody) {
        physics.unregisterBody(physBody.body);
        world.removeComponent(partId, 'physicsBody');
      }
      world.removeComponent(partId, 'item');
    }
  }

  private handleItemGraph(
    world: World,
    physics: PhysicsSystem,
    graph: EntityId[],
    totalWeight: number,
    maxRadius: number,
    maxSize: number
  ): void {
    // 1. Очищаем старые корни существ, которые потеряли мозг и чьи части теперь стали предметом
    const existingRoots = world.getEntitiesWith('assemblyRoot');
    for (const [id, comp] of existingRoots) {
      const tag = world.getComponent(id, 'tag');
      if (
        tag?.archetype === 'creature' &&
        comp.assemblyRoot.partIds?.some((pId) => graph.includes(pId))
      ) {
        const phys = world.getComponent(id, 'physicsBody');
        if (phys) physics.unregisterBody(phys.body);
        world.removeEntity(id);
      }
    }

    // 2. Находим центральную часть (максимум связей, при равенстве - наибольший размер size)
    let anchorPartId = graph[0];
    let maxLinks = -1;
    for (const id of graph) {
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

    // 3. Ищем существующий абстрактный Корень-предмет для этой связки
    const assemblyRoots = world.getEntitiesWith('assemblyRoot');
    let rootItemId = assemblyRoots.find(([id, comp]) => {
      const isItem = world.getComponent(id, 'tag')?.archetype === 'item';
      return isItem && graph.includes(comp.assemblyRoot.rootPartId);
    })?.[0];

    const anchorTransform = world.getComponent(anchorPartId, 'transform') ?? {
      x: 0,
      y: 0,
      angle: 0,
    };

    // 3. Если Корня-предмета нет — создаем абстрактную сущность-обертку
    if (!rootItemId || !world.getEntity(rootItemId)) {
      rootItemId = `item_assembly_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      world.createEntity(rootItemId);
      world.addComponent(rootItemId, 'transform', {
        x: anchorTransform.x,
        y: anchorTransform.y,
        angle: anchorTransform.angle,
      });
    }

    // Настраиваем свойства абстрактного Корня-предмета
    world.addComponent(rootItemId, 'tag', { archetype: 'item', subType: 'bodyPart' });
    world.addComponent(rootItemId, 'meta', { name: 'Часть тела', entityType: 'item' });
    world.addComponent(rootItemId, 'assemblyRoot', { rootPartId: anchorPartId, partIds: graph });

    // Добавляем компонент предмета на Корень (сами части тела остаются нетронутыми!)
    let itemComp = world.getComponent(rootItemId, 'item');
    if (!itemComp) {
      world.addComponent(rootItemId, 'item', {
        name: 'Часть тела',
        type: 'bodyPart',
        maxStack: 1,
        size: maxSize,
        equipTypes: [],
        equippable: false,
        equipTimeMultiplier: 1.0,
      });
    } else {
      itemComp.size = maxSize;
    }

    // Статы физики на Корне
    let rootPhysStats = world.getComponent(rootItemId, 'physicsStats');
    if (!rootPhysStats) {
      world.addComponent(rootItemId, 'physicsStats', {
        radius: createStat(maxRadius),
        weight: createStat(totalWeight),
        size: maxSize,
        isSolid: true,
      });
      rootPhysStats = world.getComponent(rootItemId, 'physicsStats')!;
    } else {
      setBaseStat(rootPhysStats.radius, maxRadius);
      setBaseStat(rootPhysStats.weight, totalWeight);
      rootPhysStats.size = maxSize;
    }

    const rootItemTransform = world.getComponent(rootItemId, 'transform') ?? anchorTransform;
    const ownership = world.getComponent(rootItemId, 'ownership');

    // 4. Физическое тело и рендер для Корня-предмета на полу
    if (!ownership) {
      let physBody = world.getComponent(rootItemId, 'physicsBody');
      if (!physBody) {
        const body = new Circle(
          { x: rootItemTransform.x, y: rootItemTransform.y },
          Math.max(1, maxRadius)
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
        physBody.body.r = Math.max(1, maxRadius);
        physBody.category = CollisionCategory.ITEM;
      }

      // Визуал лежащей связки на полу
      let renderable = world.getComponent(rootItemId, 'renderable');
      const boxSize = maxRadius * 1.6;
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
      // Предмет поднят в инвентарь — отключаем физику и скрываем визуал
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

    // 5. Синхронизируем положение частей тела с Корнем-предметом
    for (const partId of graph) {
      const partTransform = world.getComponent(partId, 'transform');
      if (partTransform) {
        partTransform.x = rootItemTransform.x;
        partTransform.y = rootItemTransform.y;
        partTransform.angle = rootItemTransform.angle;
      }
      // Очищаем физику, item и renderable с индивидуальных частей тела
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
