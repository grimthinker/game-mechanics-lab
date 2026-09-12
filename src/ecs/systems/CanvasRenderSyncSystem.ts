import { World } from '../World';
import { GameMode } from '../../constants';
import { RENDER_Z_INDEX, RenderCirclePrimitive, RenderPolygonPrimitive } from '../types';

export class CanvasRenderSyncSystem {
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

      // 2. Синхронизация зон-эффекторов
      if (archetype === 'zone') {
        const areaEffector = world.getComponent(id, 'areaEffector');
        if (areaEffector) {
          const circlePrim = renderable.primitives[0];
          const iconPrim = renderable.primitives[1];
          const textPrim = renderable.primitives[2];

          if (circlePrim && circlePrim.kind === 'circle') {
            circlePrim.radius = areaEffector.radius;
            if (areaEffector.effect === 'damage') {
              circlePrim.fill = 'rgba(231, 76, 60, 0.2)';
              circlePrim.stroke = '#e74c3c';
            } else if (areaEffector.effect === 'heal') {
              circlePrim.fill = 'rgba(46, 204, 113, 0.2)';
              circlePrim.stroke = '#2ecc71';
            } else if (areaEffector.effect === 'repel') {
              circlePrim.fill = 'rgba(243, 156, 18, 0.2)';
              circlePrim.stroke = '#f39c12';
            } else if (areaEffector.effect === 'attract') {
              circlePrim.fill = 'rgba(155, 89, 182, 0.2)';
              circlePrim.stroke = '#9b59b6';
            } else if (areaEffector.effect === 'time_dilation') {
              const isSpeedUp = areaEffector.valuePerSec > 1.0;
              circlePrim.fill = isSpeedUp ? 'rgba(26, 188, 156, 0.2)' : 'rgba(52, 152, 219, 0.2)';
              circlePrim.stroke = isSpeedUp ? '#1abc9c' : '#3498db';
            }
          }

          if (iconPrim && iconPrim.kind === 'text') {
            if (areaEffector.effect === 'damage') iconPrim.text = '☠️';
            else if (areaEffector.effect === 'heal') iconPrim.text = '❤️';
            else if (areaEffector.effect === 'repel') iconPrim.text = '💨';
            else if (areaEffector.effect === 'attract') iconPrim.text = '🌀';
            else if (areaEffector.effect === 'time_dilation') {
              iconPrim.text = areaEffector.valuePerSec > 1.0 ? '⚡' : '⏳';
            }
          }

          if (textPrim && textPrim.kind === 'text') {
            textPrim.offset = { x: 0, y: -(areaEffector.radius + 12) };
            const meta = world.getComponent(id, 'meta');
            if (meta) textPrim.text = meta.name;
          }
        }
        continue;
      }

      // 2.3 Синхронизация препятствий
      if (archetype === 'obstacle') {
        const health = world.getComponent(id, 'health');
        const isAlive = health ? health.isAlive : true;
        const prim = renderable.primitives[0];
        const physStats = world.getComponent(id, 'physicsStats');

        if (prim && prim.kind === 'polygon') {
          if (physStats && physStats.points) {
            prim.points = JSON.parse(JSON.stringify(physStats.points));
          }

          if (!isAlive) {
            renderable.zIndex = RENDER_Z_INDEX.ZONES;
            prim.fill = 'rgba(80, 80, 80, 0.25)';
            prim.stroke = 'rgba(120, 120, 120, 0.4)';
            prim.dash = [4, 4];
          } else {
            renderable.zIndex = RENDER_Z_INDEX.OBSTACLES;
            prim.fill = '#555555';
            prim.stroke = '#777777';
            prim.dash = undefined;
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
        const stance = meta?.stance ?? 'standing';
        const movementMode = meta?.movementMode ?? 'immobile';
        const radius = physStats ? physStats.radius.current : 16;

        // Синхронизация радиуса тела
        const bodyPrim = renderable.primitives[0];
        if (bodyPrim && bodyPrim.kind === 'circle') {
          (bodyPrim as RenderCirclePrimitive).radius = radius;
        }

        // Бесшовная миграция со старых линий на полигон для ранее сохраненных сущностей
        if (!renderable.primitives[1] || renderable.primitives[1].kind !== 'polygon') {
          renderable.primitives = [
            renderable.primitives[0],
            {
              kind: 'polygon',
              points: [
                { x: radius, y: 0 },
                { x: 0, y: -radius },
                { x: 0, y: radius },
              ],
              fill: '#7f8c8d',
              stroke: '#95a5a6',
              strokeWidth: 1.5,
            },
          ];
        } else {
          renderable.primitives[1].points = [
            { x: radius, y: 0 },
            { x: 0, y: -radius },
            { x: 0, y: radius },
          ];
        }

        const arrowPrim = renderable.primitives[1] as RenderPolygonPrimitive;

        if (bodyPrim && bodyPrim.kind === 'circle') {
          const circlePrim = bodyPrim as RenderCirclePrimitive;

          if (!isAlive) {
            circlePrim.fill = '#7f8c8d';
            renderable.zIndex = RENDER_Z_INDEX.CORPSES;
          } else {
            renderable.zIndex = RENDER_Z_INDEX.CREATURES;
            // 1. Основная заливка отображает положение (Stance)
            circlePrim.fill = stance === 'crouching' ? '#9b59b6' : '#34495e';

            // Граница: игрок / бот
            const behavior = aiStats?.behavior?.current ?? 'IdleTree';
            circlePrim.stroke = behavior === 'PlayerTree' ? '#2980b9' : '#c0392b';
          }
        }

        if (arrowPrim && arrowPrim.kind === 'polygon') {
          if (!isAlive) {
            arrowPrim.fill = 'transparent';
            arrowPrim.stroke = '#7f8c8d';
          } else {
            // 2. Треугольная стрелка заливается цветом в соответствии с видом движения
            switch (movementMode) {
              case 'immobile':
                arrowPrim.fill = '#7f8c8d';
                arrowPrim.stroke = '#95a5a6';
                break;
              case 'turning':
                arrowPrim.fill = '#f1c40f';
                arrowPrim.stroke = '#f39c12';
                break;
              case 'walking':
                arrowPrim.fill = '#1abc9c';
                arrowPrim.stroke = '#16a085';
                break;
              case 'jogging':
                arrowPrim.fill = '#3498db';
                arrowPrim.stroke = '#2980b9';
                break;
              case 'sprinting':
                arrowPrim.fill = '#2ecc71';
                arrowPrim.stroke = '#27ae60';
                break;
              default:
                arrowPrim.fill = '#7f8c8d';
                arrowPrim.stroke = '#95a5a6';
                break;
            }
          }
        }
      }
    }
  }
}
