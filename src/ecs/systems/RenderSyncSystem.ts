import { World } from '../World';
import { GameMode } from '../../constants';
import { RENDER_Z_INDEX, RenderCirclePrimitive, RenderLinePrimitive } from '../types';

export class RenderSyncSystem {
  public update(_dt: number, world: World, gameMode: GameMode): void {
    const entities = world.getEntitiesWith('renderable');

    for (const [id, { renderable }] of entities) {
      const tag = world.getComponent(id, 'tag');
      const archetype = tag?.archetype;

      // 1. Управление видимостью маркеров (видны только в режиме редактора)
      if (archetype === 'marker') {
        renderable.isVisible = gameMode === GameMode.EDITOR;
        continue;
      }

      // 2. Синхронизация триггерных зон
      if (archetype === 'zone') {
        const zoneTrigger = world.getComponent(id, 'zoneTrigger');
        if (zoneTrigger) {
          const circlePrim = renderable.primitives[0];
          const iconPrim = renderable.primitives[1];
          const textPrim = renderable.primitives[2];

          if (circlePrim && circlePrim.kind === 'circle') {
            circlePrim.radius = zoneTrigger.radius;
            if (zoneTrigger.effect === 'damage') {
              circlePrim.fill = 'rgba(231, 76, 60, 0.2)';
              circlePrim.stroke = '#e74c3c';
            } else if (zoneTrigger.effect === 'heal') {
              circlePrim.fill = 'rgba(46, 204, 113, 0.2)';
              circlePrim.stroke = '#2ecc71';
            } else if (zoneTrigger.effect === 'repel') {
              circlePrim.fill = 'rgba(243, 156, 18, 0.2)';
              circlePrim.stroke = '#f39c12';
            } else if (zoneTrigger.effect === 'attract') {
              circlePrim.fill = 'rgba(155, 89, 182, 0.2)';
              circlePrim.stroke = '#9b59b6';
            }
          }

          if (iconPrim && iconPrim.kind === 'text') {
            if (zoneTrigger.effect === 'damage') iconPrim.text = '☠️';
            else if (zoneTrigger.effect === 'heal') iconPrim.text = '❤️';
            else if (zoneTrigger.effect === 'repel') iconPrim.text = '💨';
            else if (zoneTrigger.effect === 'attract') iconPrim.text = '🌀';
          }

          if (textPrim && textPrim.kind === 'text') {
            textPrim.offset = { x: 0, y: zoneTrigger.radius + 8 };
            const meta = world.getComponent(id, 'meta');
            if (meta) textPrim.text = meta.name;
          }
        }
        continue;
      }

      // 2.5 Синхронизация предметов
      if (archetype === 'item') {
        const physStats = world.getComponent(id, 'physicsStats');
        if (physStats) {
          const radius = physStats.radius.current;
          const rectPrim = renderable.primitives[0];
          if (rectPrim && rectPrim.kind === 'rect') {
            const size = radius * 1.6;
            rectPrim.width = size;
            rectPrim.height = size;
          }
        }
      }

      // 3. Синхронизация визуального состояния существ
      if (archetype === 'creature') {
        const health = world.getComponent(id, 'health');
        const meta = world.getComponent(id, 'meta');
        const aiStats = world.getComponent(id, 'aiStats');
        const physStats = world.getComponent(id, 'physicsStats');

        const isAlive = health ? health.isAlive : true;
        const state = meta?.state ?? 'idle';
        const radius = physStats ? physStats.radius.current : 16;

        // Синхронизация радиуса и линий направления
        const bodyPrim = renderable.primitives[0];
        if (bodyPrim && bodyPrim.kind === 'circle') {
          (bodyPrim as RenderCirclePrimitive).radius = radius;
        }

        if (renderable.primitives.length >= 4) {
          const line1 = renderable.primitives[1] as RenderLinePrimitive;
          const line2 = renderable.primitives[2] as RenderLinePrimitive;
          const line3 = renderable.primitives[3] as RenderLinePrimitive;

          if (line1 && line1.kind === 'line') {
            line1.from = { x: radius, y: 0 };
            line1.to = { x: 0, y: -radius };
          }
          if (line2 && line2.kind === 'line') {
            line2.from = { x: radius, y: 0 };
            line2.to = { x: 0, y: radius };
          }
          if (line3 && line3.kind === 'line') {
            line3.from = { x: 0, y: radius };
            line3.to = { x: 0, y: -radius };
          }
        }

        if (bodyPrim && bodyPrim.kind === 'circle') {
          const circlePrim = bodyPrim as RenderCirclePrimitive;

          if (!isAlive) {
            circlePrim.fill = '#7f8c8d';
            renderable.zIndex = RENDER_Z_INDEX.CORPSES;
          } else {
            renderable.zIndex = RENDER_Z_INDEX.CREATURES;
            switch (state) {
              case 'idle':
                circlePrim.fill = '#34495e';
                break;
              case 'moving':
                circlePrim.fill = '#3498db';
                break;
              case 'running':
                circlePrim.fill = '#2ecc71';
                break;
              case 'crouching':
                circlePrim.fill = '#9b59b6';
                break;
              case 'attacking':
                circlePrim.fill = '#e67e22';
                break;
              default:
                circlePrim.fill = '#34495e';
                break;
            }

            // Актуализация цвета границы (игрок / бот)
            const behavior = aiStats?.behavior?.current ?? 'IdleTree';
            circlePrim.stroke = behavior === 'PlayerTree' ? '#2980b9' : '#c0392b';
          }
        }
      }
    }
  }
}
