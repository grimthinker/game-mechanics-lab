import React, { useState } from 'react';
import { World } from '../../ecs/World';
import { EntityConfig } from '../../ecs/types';
import { BTNodeDTO } from '../../ai/core';
import { SceneHierarchy } from './SceneHierarchy';
import { SpawnPalette } from './SpawnPalette';
import { BTGraph } from '../BTGraph';
import { useResizable } from '../../hooks/useResizable';

export type DockTab = 'hierarchy' | 'palette' | 'bt';

export interface LeftDockProps {
  world: World | null | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onFocusEntity: (id: string) => void;
  onSelectSpawnPreset: (config: EntityConfig) => void;
  btData: BTNodeDTO | null;
  btBlackboard: Record<string, any> | null;
  activeTab?: DockTab;
  onTabChange?: (tab: DockTab) => void;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  world,
  selectedEntityId,
  onSelectEntity,
  onFocusEntity,
  onSelectSpawnPreset,
  btData,
  btBlackboard,
  activeTab: externalTab,
  onTabChange,
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
          Иерархия
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
          Палитра
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
          Дерево (BT)
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

        {activeTab === 'palette' && <SpawnPalette onSelectPreset={onSelectSpawnPreset} />}

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
                  У выбранного объекта нет дерева поведения
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
              title="Перетащите для изменения высоты окна памяти"
            />

            {/* Окно памяти Blackboard */}
            <div
              style={{
                height: `${blackboardHeight}px`,
                backgroundColor: '#141414',
                overflowY: 'auto',
                padding: '8px 10px',
                fontFamily: 'monospace',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#ffcc00', marginBottom: '6px' }}>
                🧠 Память бота (Blackboard)
              </div>
              {btBlackboard && Object.keys(btBlackboard).length > 0 ? (
                Object.entries(btBlackboard).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #222',
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ color: '#64b5f6' }}>{k}:</span>
                    <span style={{ color: '#a5d6a7', textAlign: 'right', wordBreak: 'break-all' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>Память пуста</div>
              )}
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
