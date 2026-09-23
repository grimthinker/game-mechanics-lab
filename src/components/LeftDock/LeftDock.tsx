import React, { useState, useMemo } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { EntityConfig } from '../../ecs/types';
import { BTNodeDTO } from '../../ai/core';
import { SceneHierarchy } from './SceneHierarchy';
import { SpawnPalette } from './SpawnPalette';
import { BTGraph } from '../BTGraph';
import { AnimationsTab } from './AnimationsTab';
import { useResizable } from '../../hooks/useResizable';
import { t } from '../../locales';
import { BodyStructureType } from '../../ecs/templates';
import { BBKeyType } from '../../ai/schema';

export type DockTab = 'hierarchy' | 'palette' | 'bt' | 'animations';

export interface LeftDockProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onFocusEntity: (id: string) => void;
  onSelectSpawnPreset: (config: EntityConfig) => void;
  onSelectModular: (behavior: string, name: string, structureType?: BodyStructureType) => void;
  onOpenWizard: () => void;
  btData: BTNodeDTO | null;
  btBlackboard: Record<string, any> | null;
  btSchema?: Record<string, any> | null;
  activeTab?: DockTab;
  onTabChange?: (tab: DockTab) => void;
  onStartPicking?: (key: string) => void;
  pickingKey?: string | null;
}

function parseBlackboardValue(valStr: string): any {
  const trimmed = valStr.trim();
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed);
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return valStr;
    }
  }
  return valStr;
}

const BlackboardRow: React.FC<{
  k: string;
  val: any;
  info: any;
  app?: GameApp | null;
  world?: World | null;
  entityId: string | null;
  onStartPicking?: (key: string) => void;
  isPicking?: boolean;
}> = ({ k, val, info, app, world, entityId, onStartPicking, isPicking }) => {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');

  // Вычисляем тип: из схемы либо выводим по значению
  const detectedType: BBKeyType =
    info?.type ??
    (typeof val === 'boolean'
      ? 'boolean'
      : typeof val === 'number'
        ? 'number'
        : val &&
            typeof val === 'object' &&
            'x' in val &&
            'y' in val &&
            Object.keys(val).length === 2
          ? 'point'
          : k === 'targetId' || k === 'bestCandidateId'
            ? 'entityId'
            : 'string');

  React.useEffect(() => {
    if (!editing) {
      setLocalVal(
        val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
      );
    }
  }, [val, editing]);

  const commitText = () => {
    setEditing(false);
    if (app && entityId) {
      app.updateEntityBlackboard(entityId, k, parseBlackboardValue(localVal));
    }
  };

  const badge = info ? (info.isSystem ? 'SYS' : detectedType.substring(0, 3).toUpperCase()) : 'DYN';

  const renderControl = () => {
    if (detectedType === 'boolean') {
      return (
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => {
              if (app && entityId) {
                app.updateEntityBlackboard(entityId, k, e.target.checked);
              }
            }}
            style={{ accentColor: '#2ecc71', cursor: 'pointer', transform: 'scale(1.1)' }}
          />
          <span
            style={{ fontSize: '11px', color: val ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}
          >
            {val ? 'TRUE' : 'FALSE'}
          </span>
        </label>
      );
    }

    if (detectedType === 'point') {
      const px = val && typeof val === 'object' ? Math.round(val.x ?? 0) : 0;
      const py = val && typeof val === 'object' ? Math.round(val.y ?? 0) : 0;

      return (
        <div style={{ display: 'flex', flex: 1, gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#888' }}>X:</span>
          <input
            type="number"
            value={px}
            onChange={(e) => {
              if (app && entityId) {
                app.updateEntityBlackboard(entityId, k, { x: Number(e.target.value), y: py });
              }
            }}
            style={{
              width: '46px',
              backgroundColor: '#222',
              color: '#a5d6a7',
              border: '1px solid #333',
              borderRadius: '3px',
              fontSize: '11px',
              padding: '2px 4px',
              fontFamily: 'monospace',
            }}
          />
          <span style={{ fontSize: '10px', color: '#888' }}>Y:</span>
          <input
            type="number"
            value={py}
            onChange={(e) => {
              if (app && entityId) {
                app.updateEntityBlackboard(entityId, k, { x: px, y: Number(e.target.value) });
              }
            }}
            style={{
              width: '46px',
              backgroundColor: '#222',
              color: '#a5d6a7',
              border: '1px solid #333',
              borderRadius: '3px',
              fontSize: '11px',
              padding: '2px 4px',
              fontFamily: 'monospace',
            }}
          />
        </div>
      );
    }

    if (detectedType === 'entityId') {
      const currentId = typeof val === 'string' ? val : '';
      return (
        <div style={{ display: 'flex', flex: 1, gap: '6px', alignItems: 'center', minWidth: 0 }}>
          <select
            value={currentId}
            onChange={(e) => {
              const targetVal = e.target.value === '' ? null : e.target.value;
              if (app && entityId) {
                app.updateEntityBlackboard(entityId, k, targetVal);
              }
            }}
            style={{
              flex: 1,
              backgroundColor: '#222',
              color: currentId ? '#a5d6a7' : '#777',
              border: '1px solid #333',
              borderRadius: '3px',
              padding: '3px 6px',
              fontSize: '11px',
              outline: 'none',
              minWidth: 0,
              cursor: 'pointer',
            }}
          >
            <option value="">{t('dock.blackboardNone')}</option>
            {world?.getAllEntities().map(([eId, comp]) => {
              const name = comp.meta?.name || comp.item?.name || eId;
              return (
                <option key={eId} value={eId}>
                  {name} ({eId.substring(0, 8)}...)
                </option>
              );
            })}
          </select>
          {onStartPicking && (
            <button
              type="button"
              onClick={() => onStartPicking(k)}
              title={t('dock.blackboardPick')}
              style={{
                backgroundColor: isPicking ? '#e67e22' : '#2c3e50',
                color: '#fff',
                border: isPicking ? '1px solid #d35400' : 'none',
                borderRadius: '3px',
                padding: '3px 7px',
                fontSize: '12px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              🎯
            </button>
          )}
        </div>
      );
    }

    if (detectedType === 'enum' && info?.options && info.options.length > 0) {
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => {
            if (app && entityId) {
              app.updateEntityBlackboard(entityId, k, e.target.value);
            }
          }}
          style={{
            flex: 1,
            backgroundColor: '#222',
            color: '#a5d6a7',
            border: '1px solid #333',
            borderRadius: '3px',
            padding: '3px 6px',
            fontSize: '11px',
            outline: 'none',
            minWidth: 0,
            cursor: 'pointer',
          }}
        >
          {info.options.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        style={{
          flex: 1,
          backgroundColor: '#222',
          color: '#a5d6a7',
          border: '1px solid #333',
          borderRadius: '3px',
          outline: 'none',
          padding: '3px 6px',
          fontSize: '11px',
          fontFamily: 'monospace',
          width: 0,
        }}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={commitText}
        onKeyDown={(e) => e.key === 'Enter' && commitText()}
        placeholder={val === undefined ? 'undefined' : ''}
      />
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #222',
        padding: '6px 0',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '35%',
          color: info ? '#64b5f6' : '#95a5a6',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          fontSize: '12px',
        }}
        title={info?.description}
      >
        <span>{k}</span>
        <span
          style={{
            fontSize: '9px',
            opacity: 0.8,
            backgroundColor: '#333',
            color: '#ccc',
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {badge}
        </span>
      </div>

      {renderControl()}

      <button
        type="button"
        onClick={() => {
          if (app && entityId) {
            app.removeEntityBlackboardKey(entityId, k);
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#e74c3c',
          cursor: 'pointer',
          padding: '2px 6px',
          fontSize: '13px',
          flexShrink: 0,
        }}
        title={t('common.delete')}
      >
        ✕
      </button>
    </div>
  );
};

const BlackboardAddForm: React.FC<{
  app?: GameApp | null;
  selectedEntityId: string | null;
}> = ({ app, selectedEntityId }) => {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const handleAdd = () => {
    if (newKey && app && selectedEntityId) {
      app.updateEntityBlackboard(selectedEntityId, newKey, parseBlackboardValue(newVal));
      setNewKey('');
      setNewVal('');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        borderTop: '1px solid #333',
        paddingTop: '10px',
        marginTop: '4px',
      }}
    >
      <input
        type="text"
        placeholder={t('dock.blackboardKey') || 'Key'}
        value={newKey}
        onChange={(e) => setNewKey(e.target.value)}
        style={{
          width: '35%',
          backgroundColor: '#222',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
        }}
      />
      <input
        type="text"
        placeholder={t('dock.blackboardVal') || 'Value'}
        value={newVal}
        onChange={(e) => setNewVal(e.target.value)}
        style={{
          flex: 1,
          backgroundColor: '#222',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleAdd();
          }
        }}
      />
      <button
        type="button"
        onClick={handleAdd}
        style={{
          backgroundColor: '#27ae60',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        +
      </button>
    </div>
  );
};

export const LeftDock: React.FC<LeftDockProps> = ({
  app,
  world,
  selectedEntityId,
  onSelectEntity,
  onFocusEntity,
  onSelectSpawnPreset,
  onSelectModular,
  onOpenWizard,
  btData,
  btBlackboard,
  btSchema,
  activeTab: externalTab,
  onTabChange,
  onStartPicking,
  pickingKey,
}) => {
  const [internalTab, setInternalTab] = useState<DockTab>('hierarchy');
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = (tab: DockTab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  const {
    size: dockWidth,
    isResizing: isResizingDock,
    startResizing: startResizingDock,
  } = useResizable({
    storageKey: 'leftDockWidth',
    initialSize: 320,
    minSize: 260,
    maxSize: 600,
    direction: 'horizontal',
  });

  const {
    size: blackboardHeight,
    isResizing: isResizingBB,
    startResizing: startResizingBB,
  } = useResizable({
    storageKey: 'blackboardHeight',
    initialSize: 240,
    minSize: 100,
    maxSize: 500,
    direction: 'resize-top',
  });

  const sortedBBKeys = useMemo(() => {
    const allBBKeys = new Set<string>();
    if (btSchema) Object.keys(btSchema).forEach((k) => allBBKeys.add(k));
    if (btBlackboard) Object.keys(btBlackboard).forEach((k) => allBBKeys.add(k));
    return Array.from(allBBKeys).sort();
  }, [btSchema, btBlackboard]);

  return (
    <div
      style={{
        width: `${dockWidth}px`,
        minWidth: `${dockWidth}px`,
        height: '100%',
        backgroundColor: '#181818',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        zIndex: 30,
      }}
    >
      {/* Шапка вкладок */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#111',
          borderBottom: '1px solid #2a2a2a',
          padding: '4px 6px',
          gap: '4px',
        }}
      >
        <button
          onClick={() => setActiveTab('hierarchy')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'hierarchy' ? '#252525' : 'transparent',
            color: activeTab === 'hierarchy' ? '#fff' : '#888',
            border: activeTab === 'hierarchy' ? '1px solid #3a3a3a' : '1px solid transparent',
            borderRadius: '4px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {t('dock.hierarchy')}
        </button>
        <button
          onClick={() => setActiveTab('palette')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'palette' ? '#252525' : 'transparent',
            color: activeTab === 'palette' ? '#fff' : '#888',
            border: activeTab === 'palette' ? '1px solid #3a3a3a' : '1px solid transparent',
            borderRadius: '4px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {t('dock.palette')}
        </button>
        <button
          onClick={() => setActiveTab('bt')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'bt' ? '#252525' : 'transparent',
            color: activeTab === 'bt' ? '#fff' : '#888',
            border: activeTab === 'bt' ? '1px solid #3a3a3a' : '1px solid transparent',
            borderRadius: '4px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {t('dock.bt')}
        </button>
        <button
          onClick={() => setActiveTab('animations')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'animations' ? '#252525' : 'transparent',
            color: activeTab === 'animations' ? '#fff' : '#888',
            border: activeTab === 'animations' ? '1px solid #3a3a3a' : '1px solid transparent',
            borderRadius: '4px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {t('dock.animations')}
        </button>
      </div>

      {/* Тело вкладки */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'hierarchy' && (
          <SceneHierarchy
            world={world}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
            onFocusEntity={onFocusEntity}
          />
        )}

        {activeTab === 'animations' && (
          <AnimationsTab world={world} selectedEntityId={selectedEntityId} />
        )}

        {activeTab === 'palette' && (
          <SpawnPalette
            onSelectPreset={onSelectSpawnPreset}
            onSelectModular={onSelectModular}
            onOpenWizard={onOpenWizard}
          />
        )}

        {activeTab === 'bt' && (
          <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
          >
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {btData ? (
                <BTGraph tree={btData} showStatus={true} />
              ) : (
                <div
                  style={{ color: '#777', padding: '24px', textAlign: 'center', fontSize: '12px' }}
                >
                  {t('dock.noBt')}
                </div>
              )}
            </div>

            {/* Разделитель высоты памяти Blackboard */}
            <div
              onMouseDown={startResizingBB}
              style={{
                height: '5px',
                backgroundColor: isResizingBB ? '#2196f3' : '#2a2a2a',
                cursor: 'row-resize',
                borderTop: '1px solid #3a3a3a',
                borderBottom: '1px solid #111',
              }}
              title="Resize"
            />

            {/* Окно памяти Blackboard */}
            <div
              style={{
                height: `${blackboardHeight}px`,
                backgroundColor: '#141414',
                overflowY: 'auto',
                padding: '10px 12px 16px 12px',
                fontFamily: 'monospace',
                fontSize: '12px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  color: '#ffcc00',
                  marginBottom: '8px',
                  fontSize: '12px',
                }}
              >
                {t('dock.blackboardTitle')}
              </div>

              <div
                style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '10px' }}
              >
                {sortedBBKeys.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    {t('dock.blackboardEmpty')}
                  </div>
                ) : (
                  sortedBBKeys.map((k) => (
                    <BlackboardRow
                      key={k}
                      k={k}
                      val={btBlackboard?.[k]}
                      info={btSchema?.[k]}
                      app={app}
                      world={world}
                      entityId={selectedEntityId}
                      onStartPicking={onStartPicking}
                      isPicking={pickingKey === k}
                    />
                  ))
                )}
              </div>

              <BlackboardAddForm app={app} selectedEntityId={selectedEntityId} />
            </div>
          </div>
        )}
      </div>

      {/* Ручка изменения ширины левого дока */}
      <div
        onMouseDown={startResizingDock}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          backgroundColor: isResizingDock ? '#2196f3' : 'transparent',
          zIndex: 40,
        }}
        title="Потяните для изменения ширины панели"
      />
    </div>
  );
};
