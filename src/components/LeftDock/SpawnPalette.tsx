import React from 'react';
import { EntityConfig } from '../../ecs/types';
import { createZoneConfig } from '../../ecs/archetypes/ZoneArchetype';
import { createRectanglePoints, deg2Rad } from '../../utils';
import { t } from '../../locales';

interface SpawnPaletteProps {
  onSelectPreset: (config: EntityConfig) => void;
  onSelectModular: (behavior: string, name: string) => void;
}

interface PaletteItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  createConfig?: () => EntityConfig;
  onClick?: () => void;
}

interface PaletteCategory {
  title: string;
  items: PaletteItem[];
}

export const SpawnPalette: React.FC<SpawnPaletteProps> = ({ onSelectPreset, onSelectModular }) => {
  const categories: PaletteCategory[] = [
    {
      title: t('palette.categoryCreatures'),
      items: [
        {
          id: 'creature_player',
          name: t('palette.player'),
          description: t('palette.playerDesc'),
          icon: '🎮',
          onClick: () => onSelectModular('PlayerTree', t('palette.player')),
        },
        {
          id: 'creature_attacker',
          name: t('palette.attacker'),
          description: t('palette.attackerDesc'),
          icon: '⚔️',
          onClick: () => onSelectModular('AttackerTree', t('palette.attacker')),
        },
        {
          id: 'creature_idle',
          name: t('palette.idleBot'),
          description: t('palette.idleBotDesc'),
          icon: '👤',
          onClick: () => onSelectModular('IdleTree', t('palette.idleBot')),
        },
      ],
    },
    {
      title: t('palette.categoryWeapons'),
      items: [
        {
          id: 'weapon_spear',
          name: t('palette.spear'),
          description: t('palette.spearDesc'),
          icon: '🗡️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: t('palette.spear'),
              type: 'weapon',
              maxStack: 1,
              size: 10,
              equipTypes: [],
              equippable: false,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 1, isSolid: true },
            weaponStats: { baseDamage: 25, prepTime: 0.2, recoveryTime: 0.3 },
            weaponZone: { hitZoneType: 'forward_line', length: 150 },
          }),
        },
        {
          id: 'weapon_shotgun',
          name: t('palette.shotgun'),
          description: t('palette.shotgunDesc'),
          icon: '💥',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: t('palette.shotgun'),
              type: 'weapon',
              maxStack: 1,
              size: 10,
              equipTypes: [],
              equippable: false,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 1, isSolid: true },
            weaponStats: { baseDamage: 15, prepTime: 0.4, recoveryTime: 0.5 },
            weaponZone: { hitZoneType: 'shrapnel', length: 120, angle: deg2Rad(60), rayCount: 5 },
          }),
        },
        {
          id: 'weapon_aura',
          name: t('palette.auraWeapon'),
          description: t('palette.auraWeaponDesc'),
          icon: '✨',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: t('palette.auraWeapon'),
              type: 'weapon',
              maxStack: 1,
              size: 10,
              equipTypes: [],
              equippable: false,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 1, isSolid: true },
            weaponStats: { baseDamage: 30, prepTime: 0.3, recoveryTime: 0.4 },
            weaponZone: { hitZoneType: 'radius', radius: 50 },
          }),
        },
      ],
    },
    {
      title: t('palette.categoryEquipment'),
      items: [
        {
          id: 'armor_belt',
          name: t('palette.tacticalBelt'),
          description: t('palette.tacticalBeltDesc'),
          icon: '🥋',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: t('palette.tacticalBelt'),
              type: 'armor',
              maxStack: 1,
              size: 5,
              equipTypes: ['waist'],
              equippable: true,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 1.5, isSolid: true },
            armorStats: { defense: 5, flatReduction: 0 },
            equip: {
              equipmentAreas: [
                {
                  id: 'belt_sheath',
                  name: 'belt_sheath',
                  type: 'sheath',
                  space: 15,
                  itemIds: [],
                },
                {
                  id: 'belt_slot_1',
                  name: 'belt_slot_1',
                  type: 'belt_slot',
                  space: 10,
                  itemIds: [],
                },
                { id: 'belt_pouch_1', name: 'belt_pouch_1', type: 'pouch', space: 8, itemIds: [] },
              ],
            },
          }),
        },
        {
          id: 'armor_vest',
          name: t('palette.vest'),
          description: t('palette.vestDesc'),
          icon: '🦺',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: t('palette.vest'),
              type: 'armor',
              maxStack: 1,
              size: 20,
              equipTypes: ['torso'],
              equippable: true,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 12, isSolid: true },
            armorStats: { defense: 20, flatReduction: 3 },
            inventory: { size: { width: 3, height: 2 } },
            equip: {
              equipmentAreas: [
                {
                  id: 'vest_holster',
                  name: 'vest_holster',
                  type: 'holster',
                  space: 10,
                  itemIds: [],
                },
                {
                  id: 'vest_pouch',
                  name: 'vest_pouch',
                  type: 'pouch',
                  space: 10,
                  itemIds: [],
                },
              ],
            },
          }),
        },
        {
          id: 'armor_chest',
          name: t('palette.chestplate'),
          description: t('palette.chestplateDesc'),
          icon: '🛡️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: t('palette.chestplate'),
              type: 'armor',
              maxStack: 1,
              size: 20,
              equipTypes: ['torso'],
              equippable: true,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 20, isSolid: true },
            armorStats: { defense: 25, flatReduction: 5 },
          }),
        },
        {
          id: 'armor_helmet',
          name: t('palette.helmet'),
          description: t('palette.helmetDesc'),
          icon: '⛑️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: t('palette.helmet'),
              type: 'armor',
              maxStack: 1,
              size: 10,
              equipTypes: ['head'],
              equippable: true,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 10, isSolid: true },
            armorStats: { defense: 15, flatReduction: 2 },
          }),
        },
        {
          id: 'bag_backpack',
          name: t('palette.backpack'),
          description: t('palette.backpackDesc'),
          icon: '🎒',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'bag' },
            item: {
              name: t('palette.backpack'),
              type: 'bag',
              maxStack: 1,
              size: 10,
              equipTypes: ['torso', 'sling'],
              equippable: true,
              equipTimeMultiplier: 1.0,
            },
            physics: { radius: 16, weight: 1, isSolid: true },
            inventory: { size: { width: 6, height: 4 } },
          }),
        },
      ],
    },
    {
      title: t('palette.categoryObstacles'),
      items: [
        {
          id: 'obstacle_wall',
          name: t('palette.wall'),
          description: t('palette.wallDesc'),
          icon: '🧱',
          createConfig: () => ({
            tag: { archetype: 'obstacle' },
            meta: { name: t('palette.wall'), entityType: 'obstacle', destructible: false },
            physics: {
              radius: 54,
              weight: 1000,
              isSolid: true,
              points: createRectanglePoints(100, 40),
            },
          }),
        },
        {
          id: 'obstacle_crate',
          name: t('palette.crate'),
          description: t('palette.crateDesc'),
          icon: '📦',
          createConfig: () => ({
            tag: { archetype: 'obstacle' },
            meta: { name: t('palette.crate'), entityType: 'obstacle', destructible: true },
            health: { hp: 100, maxHp: 100 },
            physics: {
              radius: 42,
              weight: 50,
              isSolid: true,
              points: createRectanglePoints(60, 60),
            },
          }),
        },
      ],
    },
    {
      title: t('palette.categoryZones'),
      items: [
        {
          id: 'zone_damage',
          name: t('palette.zoneFire'),
          description: t('palette.zoneFireDesc'),
          icon: '🔥',
          createConfig: () => createZoneConfig('damage', 70, 15, t('palette.zoneFire')),
        },
        {
          id: 'zone_heal',
          name: t('palette.zoneHeal'),
          description: t('palette.zoneHealDesc'),
          icon: '💚',
          createConfig: () => createZoneConfig('heal', 70, 15, t('palette.zoneHeal')),
        },
        {
          id: 'zone_repel',
          name: t('palette.zoneRepel'),
          description: t('palette.zoneRepelDesc'),
          icon: '💨',
          createConfig: () =>
            createZoneConfig(
              'repel',
              70,
              200,
              t('palette.zoneRepel'),
              false,
              false,
              false,
              true,
              7000,
              0
            ),
        },
        {
          id: 'zone_attract',
          name: t('palette.zoneAttract'),
          description: t('palette.zoneAttractDesc'),
          icon: '🌀',
          createConfig: () =>
            createZoneConfig(
              'attract',
              70,
              200,
              t('palette.zoneAttract'),
              false,
              false,
              false,
              true,
              7000,
              0
            ),
        },
        {
          id: 'zone_time_slow',
          name: t('palette.zoneTimeSlow'),
          description: t('palette.zoneTimeSlowDesc'),
          icon: '⏳',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              70,
              0.5,
              t('palette.zoneTimeSlow'),
              false,
              false,
              false,
              false
            ),
        },
        {
          id: 'zone_time_fast',
          name: t('palette.zoneTimeFast'),
          description: t('palette.zoneTimeFastDesc'),
          icon: '⚡',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              70,
              1.8,
              t('palette.zoneTimeFast'),
              false,
              false,
              false,
              false
            ),
        },
        {
          id: 'zone_time_vortex',
          name: t('palette.zoneTimeVortex'),
          description: t('palette.zoneTimeVortexDesc'),
          icon: '🌀',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              90,
              0.5,
              t('palette.zoneTimeVortex'),
              false,
              false,
              false,
              true,
              0.2,
              1.0
            ),
        },
      ],
    },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
        {t('palette.subtitle')}
      </div>

      {categories.map((category) => (
        <div key={category.title} style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              color: '#bdc3c7',
              marginBottom: '6px',
              paddingBottom: '4px',
              borderBottom: '1px solid #2a2a2a',
            }}
          >
            {category.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {category.items.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else if (item.createConfig) onSelectPreset(item.createConfig());
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#1e1e1e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#252525';
                  e.currentTarget.style.borderColor = '#3498db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e1e1e';
                  e.currentTarget.style.borderColor = '#333';
                }}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ecf0f1' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
