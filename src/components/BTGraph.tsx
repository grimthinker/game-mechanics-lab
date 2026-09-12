import React, { useEffect, useMemo, useRef, useState } from 'react';
import dagre from 'dagre';
import { BTNodeDTO, NodeCategory, NodeStatus } from '../ai/core';
import { AI_DEBUG_CONFIG } from '../config/aiDebugConfig';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80; // Увеличено, чтобы помещались таймер и параметры

interface NodeLayout {
  id: string;
  name: string;
  category: NodeCategory;
  status?: NodeStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
  parameters?: Record<string, any>;
  timeToNextTick?: number;
  originalNode: BTNodeDTO;
}

interface EdgeLayout {
  from: string;
  to: string;
  status?: NodeStatus;
  points: { x: number; y: number }[];
}

interface StaticGraphLayout {
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>;
  edges: EdgeLayout[];
  width: number;
  height: number;
}

function getTreeTopologyKey(node: BTNodeDTO, fallbackId: string = 'root_0'): string {
  const nodeId = node.id || fallbackId;
  if (!node.children || node.children.length === 0) {
    return nodeId;
  }
  const childrenKeys = node.children.map((child, idx) =>
    getTreeTopologyKey(child, `${nodeId}_${idx}`)
  );
  return `${nodeId}(${childrenKeys.join(',')})`;
}

interface BTGraphProps {
  tree: BTNodeDTO;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: BTNodeDTO) => void;
  showStatus?: boolean;
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  RUNNING: '#ff9901',
  SUCCESS: '#13d11c',
  FAILURE: '#ff0303',
  IDLE: '#424242',
};

const TYPE_BORDERS: Record<NodeCategory, string> = {
  composite: '#2196f3',
  decorator: '#ab47bc',
  service: '#00acc1',
  action: '#ff9800',
  simple_action: '#eeff00',
  condition: '#3cff00',
};

export const BTGraph: React.FC<BTGraphProps> = ({
  tree,
  selectedNodeId,
  onNodeSelect,
  showStatus = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const topologyKey = useMemo(() => getTreeTopologyKey(tree), [tree]);

  const staticLayout = useMemo<StaticGraphLayout>(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    const processNode = (node: BTNodeDTO, fallbackId: string) => {
      const nodeId = node.id || fallbackId;
      g.setNode(nodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
      if (node.children) {
        node.children.forEach((child, idx) => {
          const childId = child.id || `${nodeId}_${idx}`;
          g.setEdge(nodeId, childId, { status: child.status });
          processNode(child, childId);
        });
      }
    };

    processNode(tree, 'root_0');
    dagre.layout(g);

    const nodePositions = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    g.nodes().forEach((nodeId) => {
      const nodeData = g.node(nodeId);
      if (nodeData) {
        nodePositions.set(nodeId, {
          x: nodeData.x,
          y: nodeData.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      }
    });

    const calculatedEdges: EdgeLayout[] = [];
    g.edges().forEach((edge) => {
      const edgeData = g.edge(edge);
      calculatedEdges.push({
        from: edge.v,
        to: edge.w,
        status: edgeData.status,
        points: edgeData.points,
      });
    });

    return {
      nodePositions,
      edges: calculatedEdges,
      width: g.graph().width || 800,
      height: g.graph().height || 600,
    };
  }, [topologyKey]);

  const nodes = useMemo(() => {
    const calculatedNodes: NodeLayout[] = [];

    const traverse = (node: BTNodeDTO, fallbackId: string) => {
      const nodeId = node.id || fallbackId;
      const pos = staticLayout.nodePositions.get(nodeId);
      if (pos) {
        calculatedNodes.push({
          id: nodeId,
          name: node.name,
          description: node.description,
          category: node.category,
          status: node.status,
          parameters: node.parameters,
          timeToNextTick: node.timeToNextTick,
          originalNode: node,
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
        });
      }
      if (node.children) {
        node.children.forEach((child, idx) => {
          traverse(child, `${nodeId}_${idx}`);
        });
      }
    };

    traverse(tree, 'root_0');
    return calculatedNodes;
  }, [tree, staticLayout]);

  const { edges, width, height } = staticLayout;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      const cursorX = isInside ? e.clientX - rect.left : rect.width / 2;
      const cursorY = isInside ? e.clientY - rect.top : rect.height / 2;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));

      const newX = cursorX - (cursorX - position.x) * (newScale / scale);
      const newY = cursorY - (cursorY - position.y) * (newScale / scale);

      setScale(newScale);
      setPosition({ x: newX, y: newY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const pointsToPath = (points: { x: number; y: number }[]) => {
    if (!points || points.length === 0) return '';
    return points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#121212',
        userSelect: 'none',
      }}
    >
      <style>
        {`
          @keyframes bt-running-dash {
            to { stroke-dashoffset: -20; }
          }
          .bt-running-edge {
            stroke: #00e5ff;
            stroke-width: 3px;
            stroke-dasharray: 8 6;
            animation: bt-running-dash 0.5s linear infinite;
          }
        `}
      </style>
      <div
        style={{
          position: 'absolute',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {edges.map((edge, idx) => {
            const isRunning = edge.status === 'RUNNING';
            return (
              <path
                key={idx}
                d={pointsToPath(edge.points)}
                fill="none"
                stroke={isRunning ? 'transparent' : '#555'}
                strokeWidth={isRunning ? '3' : '2'}
                className={isRunning ? 'bt-running-edge' : ''}
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isService = node.category === 'service';

          const nodeBgColor = isService
            ? STATUS_COLORS.RUNNING
            : showStatus && node.status
              ? STATUS_COLORS[node.status] || STATUS_COLORS.IDLE
              : '#2a2a2a';

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                if (onNodeSelect) onNodeSelect(node.originalNode);
              }}
              title={node.description ? node.description : node.name}
              style={{
                position: 'absolute',
                left: node.x - node.width / 2,
                top: node.y - node.height / 2,
                width: node.width,
                height: node.height,
                backgroundColor: nodeBgColor,
                border: `2px solid ${TYPE_BORDERS[node.category] || '#fff'}`,
                outline: isSelected ? '3px solid #00e676' : 'none',
                outlineOffset: '2px',
                borderRadius: '6px',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                boxSizing: 'border-box',
                boxShadow: isSelected
                  ? '0 0 15px #00e676'
                  : showStatus && node.status === 'RUNNING'
                    ? '0 0 12px #f57f17'
                    : '0 2px 5px rgba(0,0,0,0.5)',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>
                {node.name}
              </span>
              <span style={{ fontSize: '10px', opacity: 0.8, marginTop: '1px' }}>
                [{node.category.toUpperCase()}]
                {showStatus && !isService && node.status && <span>{` — ${node.status}`}</span>}
              </span>

              {/* Время до следующего тика (для узлов-сервисов) */}
              {node.category === 'service' && node.timeToNextTick !== undefined && (
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#00e5ff',
                    marginTop: '2px',
                  }}
                >
                  ⏱️ {node.timeToNextTick.toFixed(2)}s
                </div>
              )}

              {/* Параметры узла (для всех типов) */}
              {node.parameters && Object.keys(node.parameters).length > 0 && (
                <div
                  style={{
                    fontSize: '9px',
                    background: 'rgba(0,0,0,0.4)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    marginTop: '3px',
                    maxWidth: '95%',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {Object.entries(node.parameters)
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                    .join(', ')}
                </div>
              )}

              {/* Удержание цветовой вспышки (Flash Retention) поверх фона */}
              {node.originalNode.lastResultTime &&
              Date.now() - node.originalNode.lastResultTime < AI_DEBUG_CONFIG.btFlashDurationMs &&
              node.status !== 'RUNNING' &&
              !isService ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    backgroundColor:
                      node.originalNode.status === 'SUCCESS'
                        ? AI_DEBUG_CONFIG.colors.btFlashSuccess
                        : AI_DEBUG_CONFIG.colors.btFlashFailure,
                    opacity: Math.max(
                      0,
                      1 -
                        (Date.now() - node.originalNode.lastResultTime) /
                          AI_DEBUG_CONFIG.btFlashDurationMs
                    ),
                    transition: 'none',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
