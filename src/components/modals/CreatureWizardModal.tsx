import React, { useState } from 'react';
import { BodyStructureType, CREATURE_BLUEPRINTS } from '../../ecs/templates';
import { BEHAVIOR_TREE_NAMES } from '../../ai/trees_library';
import { ModularPlacementOptions } from '../../types';
import { t } from '../../locales';

export interface CreatureWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ModularPlacementOptions) => void;
}

const STRUCTURE_CARDS: Array<{
  type: BodyStructureType;
  icon: string;
  titleKey: string;
  descKey: string;
}> = [
  {
    type: 'humanoid',
    icon: '👤',
    titleKey: 'wizard.humanoid',
    descKey: 'wizard.humanoidDesc',
  },
  {
    type: 'quadruped',
    icon: '🐕',
    titleKey: 'wizard.quadruped',
    descKey: 'wizard.quadrupedDesc',
  },
  {
    type: 'arachnid',
    icon: '🕷️',
    titleKey: 'wizard.arachnid',
    descKey: 'wizard.arachnidDesc',
  },
];

export const CreatureWizardModal: React.FC<CreatureWizardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [structureType, setStructureType] = useState<BodyStructureType>('humanoid');
  const [behavior, setBehavior] = useState<string>('PlayerTree');
  const [name, setName] = useState<string>(() => t('wizard.humanoid'));

  if (!isOpen) return null;

  const currentBlueprint = CREATURE_BLUEPRINTS[structureType];
  const partsCount = currentBlueprint.parts.length;
  const locomotionLegsCount = currentBlueprint.parts.filter((p) => p.config.locomotion).length;
  const interactionSlotsNames =
    currentBlueprint.parts
      .filter((p) => p.config.interactionSlots)
      .map((p) => p.config.interactionSlots?.name || p.key)
      .join(', ') || t('common.empty');

  const handleStructureSelect = (newType: BodyStructureType) => {
    const prevDefaultName = t(`wizard.${structureType}`);
    setStructureType(newType);
    if (!name || name === prevDefaultName) {
      setName(t(`wizard.${newType}`));
    }
  };

  const handleSpawnClick = () => {
    const finalName = name.trim() || t(`wizard.${structureType}`);
    onConfirm({
      structureType,
      behavior,
      name: finalName,
    });
  };

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-dialog" style={{ maxWidth: '560px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', color: '#ecf0f1' }}>{t('wizard.title')}</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#888' }}>
          {t('wizard.subtitle')}
        </p>

        {/* 1. Имя существа */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#bdc3c7',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            {t('wizard.nameLabel')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#111',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              padding: '8px 10px',
              fontSize: '13px',
            }}
          />
        </div>

        {/* 2. Выбор анатомической структуры */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#bdc3c7',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            {t('wizard.structureSection')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {STRUCTURE_CARDS.map((card) => {
              const isSelected = structureType === card.type;
              return (
                <div
                  key={card.type}
                  onClick={() => handleStructureSelect(card.type)}
                  style={{
                    backgroundColor: isSelected ? '#1b4332' : '#1e1e1e',
                    border: isSelected ? '2px solid #2ecc71' : '1px solid #333',
                    borderRadius: '6px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '24px', marginBottom: '6px' }}>{card.icon}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: isSelected ? '#fff' : '#ecf0f1',
                      marginBottom: '4px',
                    }}
                  >
                    {t(card.titleKey)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#888', lineHeight: '1.2' }}>
                    {t(card.descKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Выбор поведения (дерева ИИ) */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#bdc3c7',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            {t('wizard.behaviorSection')}
          </label>
          <select
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#111',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              padding: '8px 10px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {Object.entries(BEHAVIOR_TREE_NAMES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Сводка характеристик чертежа */}
        <div
          style={{
            backgroundColor: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#aaa',
            lineHeight: '1.6',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              color: '#3498db',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontSize: '10px',
            }}
          >
            {t('wizard.summarySection')}
          </div>
          <div>• {t('wizard.partsCount', { count: partsCount })}</div>
          <div>• {t('wizard.locomotionLegs', { count: locomotionLegsCount })}</div>
          <div>• {t('wizard.interactionSlots', { slots: interactionSlotsNames })}</div>
        </div>

        {/* Кнопки действий */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            style={{ backgroundColor: '#444', color: '#fff', padding: '8px 16px' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSpawnClick}
            style={{
              backgroundColor: '#27ae60',
              color: '#fff',
              fontWeight: 'bold',
              padding: '8px 20px',
            }}
          >
            {t('wizard.spawnBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
