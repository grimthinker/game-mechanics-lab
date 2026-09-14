import React from 'react';
import { EntityConfig } from '../../ecs/types';
import { createZoneConfig } from '../../ecs/archetypes/ZoneArchetype';
import { createRectanglePoints, deg2Rad } from '../../utils';

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
      title: 'Существа',
      items: [
        {
          id: 'creature_player',
          name: 'Игрок',
          description: 'Модульное существо, дерево PlayerTree',
          icon: '🎮',
          onClick: () => onSelectModular('PlayerTree', 'Игрок'),
        },
        {
          id: 'creature_attacker',
          name: 'Бот-атакующий',
          description: 'Поиск цели, преследование, AttackerTree',
          icon: '⚔️',
          onClick: () => onSelectModular('AttackerTree', 'Бот-атакующий'),
        },
        {
          id: 'creature_idle',
          name: 'Мирный бот',
          description: 'Модульное существо без активного поведения',
          icon: '👤',
          onClick: () => onSelectModular('IdleTree', 'Мирный бот'),
        },
      ],
    },
    {
      title: 'Оружие',
      items: [
        {
          id: 'weapon_spear',
          name: 'Копьё пронзания',
          description: 'Атака прямой линией, дальность 150px',
          icon: '🗡️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: 'Копьё пронзания',
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
          name: 'Шрапнель',
          description: 'Конусный залп из 5 лучей',
          icon: '💥',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: 'Шрапнельный дробовик',
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
          name: 'Аура урона',
          description: 'Круговая атака в радиусе 50px',
          icon: '✨',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'weapon' },
            item: {
              name: 'Аура разрушения',
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
      title: 'Экипировка и Сумки',
      items: [
        {
          id: 'armor_belt',
          name: 'Тактический пояс',
          description: 'Пояс со слотами под ножны, крепление и подсумок',
          icon: '🥋',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: 'Тактический пояс',
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
                  name: 'Крепление ножен',
                  type: 'sheath',
                  space: 15,
                  itemIds: [],
                },
                { id: 'belt_slot_1', name: 'Подвес 1', type: 'belt_slot', space: 10, itemIds: [] },
                { id: 'belt_pouch_1', name: 'Карман пояса', type: 'pouch', space: 8, itemIds: [] },
              ],
            },
          }),
        },
        {
          id: 'armor_vest',
          name: 'Разгрузочный жилет',
          description: 'Броня с карманами (3x2) и подвесом под кобуру',
          icon: '🦺',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: 'Разгрузочный жилет',
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
                  name: 'Кобура жилета',
                  type: 'holster',
                  space: 10,
                  itemIds: [],
                },
                {
                  id: 'vest_pouch',
                  name: 'Подсумок жилета',
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
          name: 'Тяжёлый нагрудник',
          description: 'Броня туловища (Защита: 25, Поглощение: 5)',
          icon: '🛡️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: 'Тяжёлый нагрудник',
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
          name: 'Стальной шлем',
          description: 'Броня головы (Защита: 15, Поглощение: 2)',
          icon: '⛑️',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'armor' },
            item: {
              name: 'Стальной шлем',
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
          name: 'Рюкзак',
          description: 'Сумка для туловища, сетка 6x4 ячейки',
          icon: '🎒',
          createConfig: () => ({
            tag: { archetype: 'item', subType: 'bag' },
            item: {
              name: 'Рюкзак',
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
      title: 'Препятствия',
      items: [
        {
          id: 'obstacle_wall',
          name: 'Каменная стена',
          description: 'Неразрушаемое препятствие 100x40px',
          icon: '🧱',
          createConfig: () => ({
            tag: { archetype: 'obstacle' },
            meta: { name: 'Каменная стена', entityType: 'obstacle', destructible: false },
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
          name: 'Деревянный ящик',
          description: 'Разрушаемый объект, 100 HP, 60x60px',
          icon: '📦',
          createConfig: () => ({
            tag: { archetype: 'obstacle' },
            meta: { name: 'Деревянный ящик', entityType: 'obstacle', destructible: true },
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
      title: 'Зоны',
      items: [
        {
          id: 'zone_damage',
          name: 'Зона огня (Урон)',
          description: 'Наносит 15 урона в секунду',
          icon: '🔥',
          createConfig: () => createZoneConfig('damage', 70, 15, 'Зона огня'),
        },
        {
          id: 'zone_heal',
          name: 'Зона лечения',
          description: 'Восстанавливает 15 HP в секунду',
          icon: '💚',
          createConfig: () => createZoneConfig('heal', 70, 15, 'Зона лечения'),
        },
        {
          id: 'zone_repel',
          name: 'Силовое поле',
          description: 'Отталкивает существ наружу',
          icon: '💨',
          createConfig: () =>
            createZoneConfig('repel', 70, 200, 'Силовое поле', false, false, false, true, 7000, 0),
        },
        {
          id: 'zone_attract',
          name: 'Гравитационная воронка',
          description: 'Притягивает существ к центру',
          icon: '🌀',
          createConfig: () =>
            createZoneConfig('attract', 70, 200, 'Воронка', false, false, false, true, 7000, 0),
        },
        {
          id: 'zone_time_slow',
          name: 'Зона замедления (0.5x)',
          description: 'Замедляет локальное время вдвое (0.5x)',
          icon: '⏳',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              70,
              0.5,
              'Зона замедления (0.5x)',
              false,
              false,
              false,
              false
            ),
        },
        {
          id: 'zone_time_fast',
          name: 'Зона ускорения (1.8x)',
          description: 'Ускоряет локальное время на 80% (1.8x)',
          icon: '⚡',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              70,
              1.8,
              'Зона ускорения (1.8x)',
              false,
              false,
              false,
              false
            ),
        },
        {
          id: 'zone_time_vortex',
          name: 'Воронка времени (Градиент)',
          description: 'Плавное замедление от 0.2x в центре до 1.0x на краю',
          icon: '🌀',
          createConfig: () =>
            createZoneConfig(
              'time_dilation',
              90,
              0.5,
              'Воронка времени',
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
        Выберите шаблон и кликните на поле карты для размещения:
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
