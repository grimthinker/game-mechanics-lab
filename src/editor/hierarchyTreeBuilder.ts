import { World } from '../ecs/World';
import { getAnatomyParts } from '../ecs/utils/hierarchy';
import { getPartStatus, PartStatus } from '../ecs/utils/anatomyStatus';
import { t } from '../locales';

export type HierarchyNodeType =
  | 'creature'
  | 'bodyPart'
  | 'interactionSlot'
  | 'equipmentArea'
  | 'item'
  | 'inventoryGrid'
  | 'obstacle'
  | 'zone'
  | 'marker';

export interface HierarchyTreeNode {
  id: string;
  type: HierarchyNodeType;
  name: string;
  icon: string;
  status?: PartStatus;
  badges: { label: string; color: string }[];
  children: HierarchyTreeNode[];

  isVirtual?: boolean;
  entityId?: string; // Только если узел не виртуальный
  inspectorRootId?: string; // Какой ID использовать для selection.selectEntity
  inspectorPath?: { id: string; label: string }[];
  targetSection?: string;
  hp?: string;
}

export function buildHierarchyTree(
  world: World | null | undefined,
  search: string,
  showEmptySlots: boolean
): { tree: HierarchyTreeNode[]; matchedIds: Set<string> } {
  const tree: HierarchyTreeNode[] = [];
  const matchedIds = new Set<string>();

  if (!world) return { tree, matchedIds };

  const q = search.trim().toLowerCase();
  const allEntities = world.getAllEntities();

  const checkMatch = (name: string, id: string) => {
    if (!q) return true;
    return name.toLowerCase().includes(q) || id.toLowerCase().includes(q);
  };

  const buildItemNode = (
    itemId: string,
    parentPath: { id: string; label: string }[],
    inspectorRootId: string
  ): { node: HierarchyTreeNode | null; isMatched: boolean } => {
    const comp = world.getEntity(itemId);
    if (!comp || !comp.item) return { node: null, isMatched: false };

    const name = comp.meta?.name ?? comp.item.name;
    const isMatched = checkMatch(name, itemId);
    const myPath = [...parentPath, { id: itemId, label: name }];
    let anyChildMatched = false;

    let icon = '📦';
    if (comp.item.type === 'weapon') icon = '⚔️';
    else if (comp.item.type === 'armor') icon = '🛡️';
    else if (comp.item.type === 'bag') icon = '🎒';
    else if (comp.item.type === 'bodyPart') icon = '🥩';

    const children: HierarchyTreeNode[] = [];

    // 1. Инвентарь
    if (comp.inventory) {
      const invChildren: HierarchyTreeNode[] = [];
      let invMatched = false;
      comp.inventory.slots.forEach((row) =>
        row.forEach((cell) => {
          if (cell.itemId) {
            const res = buildItemNode(cell.itemId, myPath, inspectorRootId);
            if (res.node) {
              invChildren.push(res.node);
              if (res.isMatched) invMatched = true;
            }
          }
        })
      );

      if (invChildren.length > 0 || showEmptySlots) {
        const invName = t('hierarchy.inventoryGrid');
        const invNode: HierarchyTreeNode = {
          id: `${itemId}_inv`,
          type: 'inventoryGrid',
          name: invName,
          icon: '🗄️',
          badges: [],
          children: invChildren,
          isVirtual: true,
          inspectorRootId,
          inspectorPath: myPath,
          targetSection: 'inventory',
        };
        children.push(invNode);
        if (invMatched || checkMatch(invName, '')) {
          anyChildMatched = true;
          if (invMatched) matchedIds.add(invNode.id);
        }
      }
    }

    // 2. Области экипировки
    if (comp.equip) {
      comp.equip.equipmentAreas.forEach((area) => {
        const areaChildren: HierarchyTreeNode[] = [];
        let areaMatched = false;
        area.itemIds.forEach((subId) => {
          const res = buildItemNode(subId, myPath, inspectorRootId);
          if (res.node) {
            areaChildren.push(res.node);
            if (res.isMatched) areaMatched = true;
          }
        });

        if (areaChildren.length > 0 || showEmptySlots) {
          const areaNameBase = t('hierarchy.virtualArea', { name: area.name });
          const areaName =
            areaChildren.length > 0 ? areaNameBase : `${areaNameBase} [${t('common.empty')}]`;
          const areaNode: HierarchyTreeNode = {
            id: `${itemId}_area_${area.id}`,
            type: 'equipmentArea',
            name: areaName,
            icon: '🎽',
            badges: [],
            children: areaChildren,
            isVirtual: true,
            inspectorRootId,
            inspectorPath: myPath,
            targetSection: 'equip',
          };
          children.push(areaNode);
          if (areaMatched || checkMatch(areaNameBase, '')) {
            anyChildMatched = true;
            if (areaMatched) matchedIds.add(areaNode.id);
          }
        }
      });
    }

    const totalMatched = isMatched || anyChildMatched;
    if (totalMatched) matchedIds.add(itemId);

    if (!totalMatched && q) return { node: null, isMatched: false };

    return {
      node: {
        id: itemId,
        entityId: itemId,
        type: 'item',
        name,
        icon,
        badges: [],
        children,
        inspectorRootId,
        inspectorPath: myPath,
      },
      isMatched: totalMatched,
    };
  };

  const buildBodyPartNode = (
    partId: string,
    parentPath: { id: string; label: string }[],
    inspectorRootId: string
  ): { node: HierarchyTreeNode | null; isMatched: boolean } => {
    const comp = world.getEntity(partId);
    if (!comp) return { node: null, isMatched: false };

    const name = comp.meta?.name ?? partId;
    const isMatched = checkMatch(name, partId);
    const myPath = [...parentPath, { id: partId, label: name }];
    let anyChildMatched = false;
    const children: HierarchyTreeNode[] = [];

    // 1. Ячейки взаимодействия (Руки)
    if (comp.interactionSlots) {
      const slot = comp.interactionSlots;
      const slotNameBase = t('hierarchy.virtualSlot', { name: slot.name || slot.id });
      let slotMatched = false;
      const slotChildren: HierarchyTreeNode[] = [];

      if (slot.itemId) {
        const res = buildItemNode(slot.itemId, myPath, inspectorRootId);
        if (res.node) {
          slotChildren.push(res.node);
          if (res.isMatched) slotMatched = true;
        }
      }

      if (slotChildren.length > 0 || showEmptySlots) {
        const finalName =
          slotChildren.length > 0 ? slotNameBase : `${slotNameBase} [${t('common.empty')}]`;
        const sNode: HierarchyTreeNode = {
          id: `${partId}_slot_${slot.id}`,
          type: 'interactionSlot',
          name: finalName,
          icon: '✋',
          badges: [],
          children: slotChildren,
          isVirtual: true,
          inspectorRootId,
          inspectorPath: myPath,
          targetSection: 'slots',
        };
        children.push(sNode);
        if (slotMatched || checkMatch(slotNameBase, '')) {
          anyChildMatched = true;
          if (slotMatched) matchedIds.add(sNode.id);
        }
      }
    }

    // 2. Области экипировки
    if (comp.equip) {
      comp.equip.equipmentAreas.forEach((area) => {
        const areaChildren: HierarchyTreeNode[] = [];
        let areaMatched = false;
        area.itemIds.forEach((subId) => {
          const res = buildItemNode(subId, myPath, inspectorRootId);
          if (res.node) {
            areaChildren.push(res.node);
            if (res.isMatched) areaMatched = true;
          }
        });

        if (areaChildren.length > 0 || showEmptySlots) {
          const areaNameBase = t('hierarchy.virtualArea', { name: area.name });
          const areaName =
            areaChildren.length > 0 ? areaNameBase : `${areaNameBase} [${t('common.empty')}]`;
          const areaNode: HierarchyTreeNode = {
            id: `${partId}_area_${area.id}`,
            type: 'equipmentArea',
            name: areaName,
            icon: '🎽',
            badges: [],
            children: areaChildren,
            isVirtual: true,
            inspectorRootId,
            inspectorPath: myPath,
            targetSection: 'equip',
          };
          children.push(areaNode);
          if (areaMatched || checkMatch(areaNameBase, '')) {
            anyChildMatched = true;
            if (areaMatched) matchedIds.add(areaNode.id);
          }
        }
      });
    }

    const totalMatched = isMatched || anyChildMatched;
    if (totalMatched) matchedIds.add(partId);

    if (!totalMatched && q) return { node: null, isMatched: false };

    const status = getPartStatus(world, partId);
    const health = comp.health;
    const hp = health
      ? `${Math.round(health.current)}/${Math.round(health.max.current)}`
      : undefined;

    return {
      node: {
        id: partId,
        entityId: partId,
        type: 'bodyPart',
        name,
        icon: '🥩',
        status,
        hp,
        badges: [],
        children,
        inspectorRootId,
        inspectorPath: myPath,
      },
      isMatched: totalMatched,
    };
  };

  const buildCreatureNode = (
    creatureId: string
  ): { node: HierarchyTreeNode | null; isMatched: boolean } => {
    const comp = world.getEntity(creatureId);
    if (!comp) return { node: null, isMatched: false };

    const name = comp.meta?.name ?? creatureId;
    const isMatched = checkMatch(name, creatureId);
    const myPath = [{ id: creatureId, label: name }];
    let anyChildMatched = false;
    const children: HierarchyTreeNode[] = [];

    const parts = getAnatomyParts(world, creatureId);
    for (const pId of parts) {
      // Корневой абстрактный узел пропускаем, рисуем только дочерние bodyPart
      if (pId === creatureId) continue;
      const res = buildBodyPartNode(pId, myPath, creatureId);
      if (res.node) {
        children.push(res.node);
        if (res.isMatched) anyChildMatched = true;
      }
    }

    const totalMatched = isMatched || anyChildMatched;
    if (totalMatched) matchedIds.add(creatureId);

    if (!totalMatched && q) return { node: null, isMatched: false };

    const badges: any[] = [];
    if (comp.aiStats?.behavior.current && comp.aiStats.behavior.current !== 'IdleTree') {
      badges.push({ label: t('hierarchy.badgeAi'), color: '#2980b9' });
    }
    const hp = comp.health
      ? `${Math.round(comp.health.current)}/${Math.round(comp.health.max.current)}`
      : undefined;

    return {
      node: {
        id: creatureId,
        entityId: creatureId,
        type: 'creature',
        name,
        icon: '👤',
        hp,
        badges,
        children,
        inspectorRootId: creatureId,
        inspectorPath: myPath,
      },
      isMatched: totalMatched,
    };
  };

  const buildStandardNode = (
    id: string
  ): { node: HierarchyTreeNode | null; isMatched: boolean } => {
    const comp = world.getEntity(id);
    if (!comp) return { node: null, isMatched: false };

    const arch = comp.tag?.archetype ?? comp.meta?.entityType ?? 'unknown';
    const name = comp.meta?.name ?? comp.item?.name ?? id;
    const isMatched = checkMatch(name, id);

    if (!isMatched && q) return { node: null, isMatched: false };

    let icon = '❓';
    if (arch === 'obstacle') icon = '🧱';
    else if (arch === 'zone') icon = '🌀';
    else if (arch === 'marker') icon = '📍';

    const badges: any[] = [];
    if (comp.areaEffector) {
      badges.push({ label: t('hierarchy.badgeZone'), color: '#d35400' });
    }
    const hp = comp.health
      ? `${Math.round(comp.health.current)}/${Math.round(comp.health.max.current)}`
      : undefined;

    if (isMatched) matchedIds.add(id);

    return {
      node: {
        id,
        entityId: id,
        type: arch as HierarchyNodeType,
        name,
        icon,
        hp,
        badges,
        children: [],
        inspectorRootId: id,
        inspectorPath: [{ id, label: name }],
      },
      isMatched,
    };
  };

  // Поиск верхнеуровневых корней
  const topLevelIds = new Set<string>();

  for (const [id, comp] of allEntities) {
    const arch = comp.tag?.archetype ?? comp.meta?.entityType ?? 'creature';

    if (arch === 'creature' || arch === 'obstacle' || arch === 'marker') {
      topLevelIds.add(id);
    } else if (arch === 'zone') {
      if (!comp.attachment?.parentId) topLevelIds.add(id);
    } else if (arch === 'item' || arch === 'bodyPart') {
      if (!comp.ownership) topLevelIds.add(id);
    }
  }

  for (const id of topLevelIds) {
    const comp = world.getEntity(id);
    const arch = comp?.tag?.archetype ?? comp?.meta?.entityType ?? 'creature';

    let res;
    if (arch === 'creature') {
      res = buildCreatureNode(id);
    } else if (arch === 'item' || arch === 'bodyPart') {
      res = buildItemNode(id, [], id);
    } else {
      res = buildStandardNode(id);
    }

    if (res && res.node) {
      tree.push(res.node);
    }
  }

  return { tree, matchedIds };
}
