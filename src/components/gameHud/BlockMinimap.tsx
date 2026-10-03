import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RETRO_PANEL_STYLE, RETRO_SUNKEN_STYLE, RETRO_HEADER_STYLE } from './RetroStyles';
import { World } from '../../ecs/World';
import { EventBus } from '../../core/EventBus';
import { Camera } from '../../Camera';
import { BALANCE_CONFIG } from '../../config/balanceConfig';
import {
  generateTopographyCanvas,
  getCameraFrustumGroundCorners,
  WaterBodyData,
  ObstacleMapData,
} from './BlockMap';

export interface BlockMinimapProps {
  world?: World | null | undefined;
  playerId?: string | null;
  camera?: Camera | null | undefined;
}

export const BlockMinimap: React.FC<BlockMinimapProps> = ({ world, playerId, camera }) => {
  // Видимый размер фрагмента карты в метрах (в пределах min/max из баланс-конфига)
  const [viewSizeMeters, setViewSizeMeters] = useState<number>(
    BALANCE_CONFIG.minimap.defaultViewMeters
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cachedTerrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTerrainVersionRef = useRef<number>(-1);

  // Регулировка масштаба колесиком мыши в диапазоне из конфига баланса
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const step = e.deltaY > 0 ? 5.0 : -5.0;
      setViewSizeMeters((prev) =>
        Math.max(
          BALANCE_CONFIG.minimap.minViewMeters,
          Math.min(BALANCE_CONFIG.minimap.maxViewMeters, prev + step)
        )
      );
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Очистка кэша топографии при обновлении мира
  useEffect(() => {
    const unsub = EventBus.on('world:updated', () => {
      cachedTerrainCanvasRef.current = null;
      lastTerrainVersionRef.current = -1;
    });
    return unsub;
  }, []);

  // Отрисовка миникарты в реальном времени
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#1e241e';
    ctx.fillRect(0, 0, w, h);

    const terrainEntities = world.getEntitiesWith('terrain');
    const terrain = terrainEntities.length > 0 ? terrainEntities[0][1].terrain : undefined;

    // Обновление запеченной топографии при изменении геометрии рельефа или объектов
    const currentVersion = terrain?.geometryVersion ?? 0;
    if (
      terrain &&
      (!cachedTerrainCanvasRef.current || lastTerrainVersionRef.current !== currentVersion)
    ) {
      const waterEntities = world.getEntitiesWith('water', 'transform');
      const waters: WaterBodyData[] = waterEntities.map(([, c]) => ({
        width: c.water.width,
        depth: c.water.depth,
        x: c.transform.x,
        z: c.transform.z,
        surfaceY: c.transform.y,
        angle: c.transform.angle ?? 0,
      }));

      const obstacleEntities = world.getEntitiesWith('tag', 'transform');
      const obstacles: ObstacleMapData[] = [];
      for (const [id, comp] of obstacleEntities) {
        if (comp.tag.archetype !== 'obstacle') continue;
        const visual = world.getComponent(id, 'visualModel');
        const physStats = world.getComponent(id, 'physicsStats');
        const meta = world.getComponent(id, 'meta');

        const modelId = visual?.modelId;
        const r = physStats?.radius.current ?? 1.0;
        let widthVal = r * 2;
        let depthVal = r * 2;

        if (physStats?.points && physStats.points.length > 0) {
          let minX = physStats.points[0].x;
          let maxX = physStats.points[0].x;
          let minY = physStats.points[0].y;
          let maxY = physStats.points[0].y;
          for (let pi = 1; pi < physStats.points.length; pi++) {
            const pt = physStats.points[pi];
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
          widthVal = Math.max(0.2, maxX - minX);
          depthVal = Math.max(0.2, maxY - minY);
        }

        obstacles.push({
          id,
          subType: comp.tag.subType,
          modelId,
          name: meta?.name,
          x: comp.transform.x,
          z: comp.transform.z,
          angle: comp.transform.angle ?? 0,
          radius: r,
          width: widthVal,
          depth: depthVal,
          points: physStats?.points,
        });
      }

      cachedTerrainCanvasRef.current = generateTopographyCanvas(terrain, waters, obstacles);
      lastTerrainVersionRef.current = currentVersion;
    }

    // Игрок находится строго по центру экрана миникарты
    const playerTrans = playerId ? world.getComponent(playerId, 'transform') : undefined;
    const centerX = playerTrans?.x ?? 0;
    const centerZ = playerTrans?.z ?? 0;

    const terrainW = terrain?.width ?? 100;
    const terrainD = terrain?.depth ?? 100;

    // Пикселей на метр, исходя из текущего охвата viewSizeMeters
    const ppm = Math.min(w, h) / viewSizeMeters;

    const worldToScreen = (wx: number, wz: number) => ({
      x: w / 2 + (wx - centerX) * ppm,
      y: h / 2 + (wz - centerZ) * ppm,
    });

    // 1. Подложка террейна с водой и препятствиями
    if (cachedTerrainCanvasRef.current) {
      const topLeft = worldToScreen(-terrainW / 2, -terrainD / 2);
      const mapDrawW = terrainW * ppm;
      const mapDrawH = terrainD * ppm;

      ctx.drawImage(cachedTerrainCanvasRef.current, topLeft.x, topLeft.y, mapDrawW, mapDrawH);

      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.strokeRect(topLeft.x, topLeft.y, mapDrawW, mapDrawH);
    }

    // 2. Игровые зоны
    const zones = world.getEntitiesWith('gameplayZone', 'transform');
    for (const [zId, { gameplayZone, transform }] of zones) {
      const pos = worldToScreen(transform.x, transform.z);
      const shape = world.getComponent(zId, 'zoneShape');
      const r = (shape?.radius ?? 3.0) * ppm;

      ctx.fillStyle =
        gameplayZone.role === 'quest'
          ? 'rgba(0, 229, 255, 0.25)'
          : gameplayZone.role === 'throw_target'
            ? 'rgba(230, 126, 34, 0.25)'
            : 'rgba(241, 196, 15, 0.2)';
      ctx.strokeStyle =
        gameplayZone.role === 'quest'
          ? '#00e5ff'
          : gameplayZone.role === 'throw_target'
            ? '#e67e22'
            : '#f1c40f';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Другие существа (только живые существа, исключая препятствия)
    const creatures = world.getEntitiesWith('meta', 'transform', 'health');
    for (const [cId, { meta, transform, health }] of creatures) {
      if (cId === playerId) continue;

      const tag = world.getComponent(cId, 'tag');
      const arch = tag?.archetype ?? meta.entityType;
      if (arch !== 'creature') continue;

      const pos = worldToScreen(transform.x, transform.z);

      if (!health.isAlive) {
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pos.x - 3, pos.y - 3);
        ctx.lineTo(pos.x + 3, pos.y + 3);
        ctx.moveTo(pos.x + 3, pos.y - 3);
        ctx.lineTo(pos.x - 3, pos.y + 3);
        ctx.stroke();
        continue;
      }

      const ai = world.getComponent(cId, 'aiStats');
      const isAttacker = ai?.behavior.current === 'AttackerTree';
      const isDog =
        meta.name.toLowerCase().includes('собака') || meta.name.toLowerCase().includes('dog');

      ctx.fillStyle = isAttacker ? '#e74c3c' : isDog ? '#e67e22' : '#3498db';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 4. Поле видимости камеры (Frustum)
    if (camera) {
      const aspect =
        typeof window !== 'undefined' && window.innerHeight > 0
          ? window.innerWidth / window.innerHeight
          : 16 / 9;
      const frustumPoints = getCameraFrustumGroundCorners(camera, aspect, 50);

      if (frustumPoints.length === 4) {
        const screenCorners = frustumPoints.map((pt) => worldToScreen(pt.x, pt.z));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
        for (let i = 1; i < screenCorners.length; i++) {
          ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();

        ctx.fillStyle = '#00e5ff';
        for (let i = 0; i < screenCorners.length; i++) {
          ctx.fillRect(screenCorners[i].x - 1.5, screenCorners[i].y - 1.5, 3, 3);
        }

        ctx.restore();
      }
    }

    // 5. Маркер игрока по центру
    if (playerTrans) {
      const pPos = worldToScreen(centerX, centerZ);
      const angle = playerTrans.angle;

      ctx.save();
      ctx.translate(pPos.x, pPos.y);

      ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 24, angle - Math.PI / 6, angle + Math.PI / 6);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(angle);
      ctx.fillStyle = '#2ecc71';
      ctx.strokeStyle = '#0e3a1f';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -4.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 6. Информационная плашка охвата
    ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
    ctx.fillRect(4, h - 18, 110, 14);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(viewSizeMeters)}x${Math.round(viewSizeMeters)} м`, 8, h - 8);
  }, [world, playerId, viewSizeMeters, camera]);

  // Анимационный цикл перерисовки
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      renderMinimap();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [renderMinimap]);

  // Автоматическая подгонка размеров холста
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvasRef.current) {
          canvasRef.current.width = entry.contentRect.width;
          canvasRef.current.height = entry.contentRect.height;
          renderMinimap();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderMinimap]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 220,
        height: 242,
        ...RETRO_PANEL_STYLE,
        padding: '6px',
        zIndex: 88,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Шапка без кнопки закрытия и без возможности перетаскивания */}
      <div style={{ ...RETRO_HEADER_STYLE, marginBottom: '4px', padding: '3px 8px' }}>
        <span>МИНИКАРТА</span>
        <span style={{ fontSize: '11px', color: '#a7f3d0' }}>{Math.round(viewSizeMeters)}м</span>
      </div>

      {/* Углубленный контейнер с квадратным холстом */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          ...RETRO_SUNKEN_STYLE,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'crosshair',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Кнопки регулировки масштаба в пределах лимитов конфига */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewSizeMeters((v) => Math.max(BALANCE_CONFIG.minimap.minViewMeters, v - 10.0));
            }}
            disabled={viewSizeMeters <= BALANCE_CONFIG.minimap.minViewMeters}
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              border: '1px solid #444',
              cursor:
                viewSizeMeters <= BALANCE_CONFIG.minimap.minViewMeters ? 'default' : 'pointer',
              opacity: viewSizeMeters <= BALANCE_CONFIG.minimap.minViewMeters ? 0.4 : 1,
              fontWeight: 'bold',
              padding: 0,
              fontSize: '11px',
              lineHeight: '16px',
            }}
            title="Приблизить"
          >
            +
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewSizeMeters((v) => Math.min(BALANCE_CONFIG.minimap.maxViewMeters, v + 10.0));
            }}
            disabled={viewSizeMeters >= BALANCE_CONFIG.minimap.maxViewMeters}
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              border: '1px solid #444',
              cursor:
                viewSizeMeters >= BALANCE_CONFIG.minimap.maxViewMeters ? 'default' : 'pointer',
              opacity: viewSizeMeters >= BALANCE_CONFIG.minimap.maxViewMeters ? 0.4 : 1,
              fontWeight: 'bold',
              padding: 0,
              fontSize: '11px',
              lineHeight: '16px',
            }}
            title="Отдалить"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};
