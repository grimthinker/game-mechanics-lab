import React from 'react';
import { PlacementMode, BlackboardPickingState } from '../../types';
import { t } from '../../locales';

interface PlacementOverlaysProps {
  placementMode: PlacementMode | null;
  bbPicking: BlackboardPickingState | null;
  onCancelPlacement: () => void;
  onCancelBBPicking: () => void;
}

export const PlacementOverlays: React.FC<PlacementOverlaysProps> = ({
  placementMode,
  bbPicking,
  onCancelPlacement,
  onCancelBBPicking,
}) => {
  return (
    <>
      {placementMode && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(41, 128, 185, 0.9)',
            padding: '10px 20px',
            borderRadius: '8px',
            display: 'flex',
            gap: '15px',
            alignItems: 'center',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <span>{t('app.placementPrompt')}</span>
          <button
            className="btn btn-sm"
            style={{ backgroundColor: '#c0392b' }}
            onClick={onCancelPlacement}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {bbPicking && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(142, 68, 173, 0.95)',
            padding: '10px 20px',
            borderRadius: '8px',
            display: 'flex',
            gap: '15px',
            alignItems: 'center',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            color: '#fff',
            fontSize: '12px',
          }}
        >
          <span>🎯 {t('dock.blackboardPickingPrompt', { key: bbPicking.key })}</span>
          <button
            className="btn btn-sm"
            style={{ backgroundColor: '#c0392b', color: '#fff' }}
            onClick={onCancelBBPicking}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </>
  );
};
