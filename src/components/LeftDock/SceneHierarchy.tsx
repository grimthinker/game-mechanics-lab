import React, { useState, useMemo, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { t } from '../../locales';
import { buildHierarchyTree, HierarchyTreeNode } from '../../editor/hierarchyTreeBuilder';
import { EventBus } from '../../core/EventBus';
import { PartStatus } from '../../ecs/utils/anatomyStatus';
import { useDragDrop } from '../../dnd/DragDropContext';
import { findItemLocation } from '../../ecs/utils/itemValidation';
import { getRootOwner } from '../../ecs/utils/hierarchy';

interface SceneHierarchyProps {
  world: World | null | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onFocusEntity: (id: string) => void;
}

const HierarchyNodeItem: React.FC<{
  node: HierarchyTreeNode;
  world: World | null | undefined;
  depth: number;
  expanded: Set<string>;
  searchMatchedIds: Set<string>;
  searchActive: boolean;
  activeId: string | null;
  onToggle: (id: string, recursive: boolean, node: HierarchyTreeNode) => void;
  onSelect: (node: HierarchyTreeNode) => void;
  onDoubleClick: (node: HierarchyTreeNode) => void;
  onAutoExpand: (id: string) => void;
}> = ({
  node,
  world,
  depth,
  expanded,
  searchMatchedIds,
  searchActive,
  activeId,
  onToggle,
  onSelect,
  onDoubleClick,
  onAutoExpand,
}) => {
  const isExpanded = expanded.has(node.id) || (searchActive && searchMatchedIds.has(node.id));
  const hasChildren = node.children.length > 0;

  const { isDragging, startDrag, setHoverTarget, hoverTarget, isValidTarget, isSwap } =
    useDragDrop();

  const dragCandidateRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggingRef = useRef(false);

  // Узел считается активным, если его внутренний id совпадает с тем, куда навигируется Инспектор
  const isActive = activeId === node.id || (activeId === node.entityId && !node.isVirtual);
  const isHoveredTarget =
    isDragging &&
    hoverTarget &&
    node.transferTarget &&
    JSON.stringify(hoverTarget) === JSON.stringify(node.transferTarget);

  const getTextColor = () => {
    if (isActive) return '#fff';
    if (node.status === PartStatus.DESTROYED) return '#e74c3c';
    if (node.status === PartStatus.BROKEN) return '#f39c12';
    if (node.isVirtual) return '#95a5a6';
    return '#ccc';
  };

  let bgColor = isActive ? '#1b4332' : 'transparent';
  let borderColor = isActive ? '1px solid #2ecc71' : '1px solid transparent';

  if (isHoveredTarget) {
    if (isValidTarget && isSwap) {
      bgColor = '#154360';
      borderColor = '1px solid #3498db';
    } else if (isValidTarget) {
      bgColor = '#1e8449';
      borderColor = '1px solid #2ecc71';
    } else {
      bgColor = '#641e16';
      borderColor = '1px solid #e74c3c';
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (node.type === 'item') {
      dragCandidateRef.current = { x: e.clientX, y: e.clientY };
      wasDraggingRef.current = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragCandidateRef.current && !isDragging) {
      const dx = e.clientX - dragCandidateRef.current.x;
      const dy = e.clientY - dragCandidateRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        if (world && node.entityId) {
          const comp = world.getEntity(node.entityId);
          if (comp && comp.item) {
            const source = findItemLocation(world, node.entityId);
            if (source) {
              startDrag(
                {
                  id: node.entityId,
                  name: node.name,
                  icon: node.icon,
                  size: comp.item.size,
                  weight: comp.physicsStats?.weight.current ?? 1,
                },
                source,
                e.clientX,
                e.clientY
              );
            }
          }
        }
        dragCandidateRef.current = null;
        wasDraggingRef.current = true;
      }
    }
  };

  const handlePointerUp = () => {
    // Если бросили предмет в валидный узел — автоматически раскрываем его
    if (isDragging && isHoveredTarget && isValidTarget) {
      onAutoExpand(node.id);
    }
    dragCandidateRef.current = null;
  };

  const handlePointerEnter = () => {
    if (isDragging && node.transferTarget) {
      setHoverTarget(node.transferTarget);
    }
  };

  const handlePointerLeave = () => {
    if (isDragging && isHoveredTarget) {
      setHoverTarget(null);
    }
  };

  return (
    <div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => {
          e.stopPropagation();
          if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
          }
          if (e.ctrlKey && hasChildren) {
            onToggle(node.id, e.altKey, node);
          } else {
            onSelect(node);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick(node);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `4px 8px 4px ${4 + depth * 14}px`,
          cursor: 'pointer',
          backgroundColor: bgColor,
          border: borderColor,
          borderRadius: '4px',
          margin: '1px 4px',
          userSelect: 'none',
          transition: 'background-color 0.1s, border-color 0.1s',
        }}
        title={`ID: ${node.entityId || node.id}`}
      >
        <span
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(node.id, e.altKey, node);
            }
          }}
          style={{
            width: '16px',
            display: 'inline-block',
            textAlign: 'center',
            cursor: hasChildren ? 'pointer' : 'default',
            color: '#888',
            fontSize: '10px',
            flexShrink: 0,
          }}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </span>

        <span style={{ fontSize: '13px', marginRight: '6px', flexShrink: 0 }}>{node.icon}</span>

        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}
        >
          <span
            style={{
              color: getTextColor(),
              fontSize: '12px',
              fontWeight: isActive ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textDecoration: node.status === PartStatus.DESTROYED ? 'line-through' : 'none',
            }}
          >
            {node.name}
          </span>
          {node.badges.map((b, i) => (
            <span
              key={i}
              style={{
                backgroundColor: b.color,
                color: '#fff',
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>

        {node.hp && (
          <span style={{ fontSize: '9px', color: '#27ae60', marginLeft: '6px', flexShrink: 0 }}>
            {node.hp}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <HierarchyNodeItem
              key={child.id}
              node={child}
              world={world}
              depth={depth + 1}
              expanded={expanded}
              searchMatchedIds={searchMatchedIds}
              searchActive={searchActive}
              activeId={activeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onAutoExpand={onAutoExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SceneHierarchy: React.FC<SceneHierarchyProps> = ({
  world,
  selectedEntityId,
  onSelectEntity,
  onFocusEntity,
}) => {
  const [search, setSearch] = useState('');
  const [showEmptySlots, setShowEmptySlots] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('scene_hierarchy_show_empty_slots');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return false;
  });

  useEffect(() => {
    localStorage.setItem('scene_hierarchy_show_empty_slots', JSON.stringify(showEmptySlots));
  }, [showEmptySlots]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(selectedEntityId);
  const lastSelectedRootRef = React.useRef<string | null>(selectedEntityId);

  // Обновляем активный узел, ТОЛЬКО если выделение пришло извне (кликнули на другого моба на холсте)
  useEffect(() => {
    if (selectedEntityId !== lastSelectedRootRef.current) {
      lastSelectedRootRef.current = selectedEntityId;
      setActiveNodeId(selectedEntityId);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    const unsub = EventBus.on('inspector:navigate', (data) => {
      if (data.path && data.path.length > 0) {
        setActiveNodeId(data.path[data.path.length - 1].id);
        lastSelectedRootRef.current = data.rootEntityId;
      }
    });
    return unsub;
  }, []);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('scene_hierarchy_expanded_nodes');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem(
      'scene_hierarchy_expanded_nodes',
      JSON.stringify(Array.from(expandedNodes))
    );
  }, [expandedNodes]);

  // Локальная ревизия мира: перерисовывает дерево при изменениях в ECS
  const [worldRevision, setWorldRevision] = useState(0);

  useEffect(() => {
    const unsub = EventBus.on('world:updated', () => {
      setWorldRevision((prev) => prev + 1);
    });
    return unsub;
  }, []);

  const { tree, matchedIds } = useMemo(() => {
    return buildHierarchyTree(world, search, showEmptySlots);
  }, [world, search, showEmptySlots, worldRevision]);

  const handleAutoExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string, recursive: boolean, node: HierarchyTreeNode) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      const isCurrentlyExpanded = next.has(id);

      const process = (n: HierarchyTreeNode, expand: boolean) => {
        if (expand) next.add(n.id);
        else next.delete(n.id);
        if (recursive) {
          n.children.forEach((c) => process(c, expand));
        }
      };

      process(node, !isCurrentlyExpanded);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const traverse = (n: HierarchyTreeNode) => {
      if (n.children.length > 0) allIds.add(n.id);
      n.children.forEach(traverse);
    };
    tree.forEach(traverse);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleSelect = (node: HierarchyTreeNode) => {
    const rootId = node.inspectorRootId || node.entityId;
    if (!rootId) return;

    // Запоминаем корень, чтобы предотвратить сброс выделения эффектом useEffect
    lastSelectedRootRef.current = rootId;

    if (node.isVirtual) {
      onSelectEntity(rootId);
      EventBus.emit('inspector:navigate', {
        rootEntityId: rootId,
        path: node.inspectorPath || [],
        targetSection: node.targetSection,
      });
    } else {
      onSelectEntity(rootId);
      EventBus.emit('inspector:navigate', {
        rootEntityId: rootId,
        // Если кликнули прямо на корень (Игрок), сбрасываем хлебные крошки до него
        path: node.inspectorPath || [{ id: node.entityId!, label: node.name }],
      });
    }

    setActiveNodeId(node.id);
  };

  const handleDoubleClick = (node: HierarchyTreeNode) => {
    const focusId = node.entityId || node.inspectorRootId;
    if (focusId) onFocusEntity(focusId);
  };

  const { isDragging, dragItem, setHoverTarget } = useDragDrop();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder={t('hierarchy.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              boxSizing: 'border-box',
              backgroundColor: '#111',
              border: '1px solid #333',
              color: '#fff',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label
            style={{
              fontSize: '10px',
              color: '#aaa',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showEmptySlots}
              onChange={(e) => setShowEmptySlots(e.target.checked)}
            />
            {t('hierarchy.showEmptySlots')}
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={expandAll}
              title={t('hierarchy.expandAll')}
              style={{
                background: 'none',
                border: 'none',
                color: '#3498db',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ⊞
            </button>
            <button
              onClick={collapseAll}
              title={t('hierarchy.collapseAll')}
              style={{
                background: 'none',
                border: 'none',
                color: '#e74c3c',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ⊟
            </button>
          </div>
        </div>
      </div>

      <div
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
        onPointerOver={(e) => {
          if (isDragging && e.target === e.currentTarget && dragItem && world) {
            const source = findItemLocation(world, dragItem.id);
            let rootId = null;
            if (source?.type === 'slot') rootId = getRootOwner(world, source.partId);
            else if (source?.type === 'area' || source?.type === 'inventory')
              rootId = getRootOwner(world, source.containerId);

            if (rootId) {
              setHoverTarget({ type: 'ground', parentEntityId: rootId });
            } else {
              setHoverTarget({ type: 'ground' });
            }
          }
        }}
      >
        {tree.length === 0 ? (
          <div
            style={{
              padding: '10px',
              fontSize: '11px',
              color: '#555',
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            {t('hierarchy.empty')}
          </div>
        ) : (
          tree.map((node) => (
            <HierarchyNodeItem
              key={node.id}
              node={node}
              world={world}
              depth={0}
              expanded={expandedNodes}
              searchMatchedIds={matchedIds}
              searchActive={search.trim() !== ''}
              activeId={activeNodeId}
              onToggle={toggleExpand}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onAutoExpand={handleAutoExpand}
            />
          ))
        )}
      </div>
    </div>
  );
};
