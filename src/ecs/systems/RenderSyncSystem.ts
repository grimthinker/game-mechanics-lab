import { World } from '../World';
import { GameMode } from '../../constants';
import { RENDER_Z_INDEX, RenderCirclePrimitive } from '../types';

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
        if (zoneTrigger && renderable.primitives[0]?.kind === 'circle') {
          (renderable.primitives[0] as RenderCirclePrimitive).radius = zoneTrigger.radius;
        }
        continue;
      }

      // 3. Синхронизация визуального состояния существ
      if (archetype === 'creature') {
        const healthStats = world.getComponent(id, 'healthStats');
        const health = world.getComponent(id, 'health');
        const meta = world.getComponent(id, 'meta');
        const aiStats = world.getComponent(id, 'aiStats');

        const isAlive = healthStats ? healthStats.hp.current > 0 : (health?.isAlive ?? true);
        const state = meta?.state ?? 'idle';

        // Первым примитивом существа является тело (круг)
        const bodyPrim = renderable.primitives[0];
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