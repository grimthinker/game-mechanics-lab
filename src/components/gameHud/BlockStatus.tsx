import React, { useState } from 'react';
import { World } from '../../ecs/World';
import { getAnatomyParts } from '../../ecs/utils/hierarchy';
import { RETRO_PANEL_STYLE, RETRO_SUNKEN_STYLE } from './RetroStyles';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface BlockStatusProps {
  world: World | null | undefined;
  playerId: string | null;
}

interface StatBarDef {
  id: string;
  label: string;
  color: string;
  current: number;
  max: number;
}

interface PartFpInfo {
  name: string;
  percent: number;
}

/**
 * Рассчитывает цвет части тела по ее функциональной прочности (ФП)
 */
function getFpColor(currentFp: number, maxFp: number): string {
  if (maxFp <= 0) return HUD_CONFIG.status.paperDoll.fpIntact;
  const ratio = currentFp / maxFp;

  if (ratio >= 0.5) {
    const t = Math.min(1, Math.max(0, (ratio - 0.5) / 0.5));
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * (1 - t) + 230 * t);
    return `rgb(${r}, ${g}, 0)`;
  } else if (ratio >= 0) {
    const t = Math.min(1, Math.max(0, ratio / 0.5));
    const g = Math.round(255 * t);
    return `rgb(255, ${g}, 0)`;
  } else {
    const t = Math.min(1, Math.max(0, (ratio - -2.0) / 2.0));
    const r = Math.round(255 * t);
    return `rgb(${r}, 0, 0)`;
  }
}

export const BlockStatus: React.FC<BlockStatusProps> = ({ world, playerId }) => {
  const [bars, setBars] = useState<Array<StatBarDef & { icon: string; title: string }>>([
    {
      id: 'red',
      icon: '🩸',
      title: 'Запас крови',
      label: 'Запас крови',
      color: HUD_CONFIG.status.bars.health,
      current: 75,
      max: 100,
    },
    {
      id: 'green',
      icon: '💪',
      title: 'Запас сил',
      label: 'Запас сил',
      color: HUD_CONFIG.status.bars.stamina,
      current: 90,
      max: 100,
    },
    {
      id: 'purple',
      icon: '👁️',
      title: 'Концентрация',
      label: 'Концентрация',
      color: HUD_CONFIG.status.bars.energy,
      current: 50,
      max: 100,
    },
    {
      id: 'cyan',
      icon: '🔷',
      title: 'Запас энергии',
      label: 'Запас энергии',
      color: HUD_CONFIG.status.bars.resilience,
      current: 65,
      max: 100,
    },
    {
      id: 'orange',
      icon: '⚖️',
      title: 'Баланс',
      label: 'Баланс',
      color: HUD_CONFIG.status.bars.balance,
      current: 40,
      max: 100,
    },
  ]);

  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);
  const [hoveredPartKey, setHoveredPartKey] = useState<string | null>(null);

  const playerName =
    (playerId && world ? world.getComponent(playerId, 'meta')?.name : null) || 'Игрок';

  const animator = playerId && world ? world.getComponent(playerId, 'animator') : null;
  const isHumanoid = animator?.rigType === 'humanoid';

  const partColors: Record<string, string> = {
    head: HUD_CONFIG.status.paperDoll.fpIntact,
    torso: HUD_CONFIG.status.paperDoll.fpIntact,
    arm_l: HUD_CONFIG.status.paperDoll.fpIntact,
    arm_r: HUD_CONFIG.status.paperDoll.fpIntact,
    leg_l: HUD_CONFIG.status.paperDoll.fpIntact,
    leg_r: HUD_CONFIG.status.paperDoll.fpIntact,
  };

  const partFp: Record<string, PartFpInfo> = {
    head: { name: 'Голова', percent: 100 },
    torso: { name: 'Туловище', percent: 100 },
    arm_l: { name: 'Левая рука', percent: 100 },
    arm_r: { name: 'Правая рука', percent: 100 },
    leg_l: { name: 'Левая нога', percent: 100 },
    leg_r: { name: 'Правая нога', percent: 100 },
  };

  if (isHumanoid && world && playerId) {
    const parts = getAnatomyParts(world, playerId);
    for (const pId of parts) {
      const tag = world.getComponent(pId, 'tag');
      const fp = world.getComponent(pId, 'functionalHealth');
      const meta = world.getComponent(pId, 'meta');
      const color = fp
        ? getFpColor(fp.current, fp.max.current)
        : HUD_CONFIG.status.paperDoll.fpIntact;
      const percent =
        fp && fp.max.current > 0 ? Math.round((fp.current / fp.max.current) * 100) : 100;

      if (tag?.subType === 'head' || pId.includes('head')) {
        partColors.head = color;
        partFp.head = { name: meta?.name || 'Голова', percent };
      } else if (tag?.subType === 'torso' || pId.includes('torso')) {
        partColors.torso = color;
        partFp.torso = { name: meta?.name || 'Туловище', percent };
      } else if (tag?.subType === 'arm' || pId.includes('arm')) {
        if (pId.includes('arm_l') || pId.includes('left')) {
          partColors.arm_l = color;
          partFp.arm_l = { name: meta?.name || 'Левая рука', percent };
        } else {
          partColors.arm_r = color;
          partFp.arm_r = { name: meta?.name || 'Правая рука', percent };
        }
      } else if (tag?.subType === 'leg' || pId.includes('leg')) {
        if (pId.includes('leg_l') || pId.includes('left')) {
          partColors.leg_l = color;
          partFp.leg_l = { name: meta?.name || 'Левая нога', percent };
        } else {
          partColors.leg_r = color;
          partFp.leg_r = { name: meta?.name || 'Правая нога', percent };
        }
      }
    }
  }

  const handleSpendBar = (barId: string) => {
    setBars((prev) =>
      prev.map((b) => {
        if (b.id !== barId) return b;
        const nextVal = b.current - 15 < 0 ? b.max : b.current - 15;
        return { ...b, current: nextVal };
      })
    );
  };

  const getPartStroke = (key: string) =>
    hoveredPartKey === key
      ? HUD_CONFIG.status.paperDoll.hoverStroke
      : HUD_CONFIG.status.paperDoll.outline;

  const getPartStrokeWidth = (key: string) => (hoveredPartKey === key ? 2.5 : 1.5);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 440,
        height: 168,
        ...RETRO_PANEL_STYLE,
        padding: '10px 14px',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Имя персонажа */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: HUD_CONFIG.status.playerNameText,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '8px',
        }}
        title={playerName}
      >
        {playerName}
      </div>

      {/* Блок полосок и куклы: центр круга куклы выровнен строго по 3-й полоске */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {bars.map((bar) => {
            const ratio = Math.max(0, Math.min(1, bar.current / bar.max));
            const isHovered = hoveredBarId === bar.id;

            return (
              <div key={bar.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', cursor: 'help', flexShrink: 0 }} title={bar.title}>
                  {bar.icon}
                </span>

                <div
                  onClick={() => handleSpendBar(bar.id)}
                  onMouseEnter={() => setHoveredBarId(bar.id)}
                  onMouseLeave={() => setHoveredBarId(null)}
                  style={{
                    flex: 1,
                    height: '11px',
                    ...RETRO_SUNKEN_STYLE,
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    backgroundColor: HUD_CONFIG.status.bars.barBg,
                  }}
                  title="Кликните для демонстрации расхода ресурса"
                >
                  <div
                    style={{
                      width: `${ratio * 100}%`,
                      height: '100%',
                      backgroundColor: bar.color,
                      transition: 'width 0.2s ease-out',
                    }}
                  />

                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        lineHeight: '11px',
                        fontWeight: 'bold',
                        color: HUD_CONFIG.status.bars.barText,
                        pointerEvents: 'none',
                      }}
                    >
                      {bar.current} / {bar.max}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Кукла анатомии на круглой плашке */}
        <div
          style={{
            width: 104,
            height: 104,
            minWidth: 104,
            minHeight: 104,
            ...RETRO_SUNKEN_STYLE,
            backgroundColor: HUD_CONFIG.status.paperDoll.circleBg,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isHumanoid ? (
            <>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                {/* Голова */}
                <circle
                  cx="50"
                  cy="18"
                  r="9"
                  fill={partColors.head}
                  stroke={getPartStroke('head')}
                  strokeWidth={getPartStrokeWidth('head')}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('head')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.head.name}: {partFp.head.percent}%
                  </title>
                </circle>
                {/* Туловище */}
                <rect
                  x="42"
                  y="30"
                  width="16"
                  height="27"
                  rx="1.5"
                  fill={partColors.torso}
                  stroke={getPartStroke('torso')}
                  strokeWidth={getPartStrokeWidth('torso')}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('torso')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.torso.name}: {partFp.torso.percent}%
                  </title>
                </rect>
                {/* Левая рука */}
                <rect
                  x="13"
                  y="32"
                  width="27"
                  height="7"
                  rx="1.5"
                  fill={partColors.arm_l}
                  stroke={getPartStroke('arm_l')}
                  strokeWidth={getPartStrokeWidth('arm_l')}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('arm_l')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.arm_l.name}: {partFp.arm_l.percent}%
                  </title>
                </rect>
                {/* Правая рука */}
                <rect
                  x="60"
                  y="32"
                  width="27"
                  height="7"
                  rx="1.5"
                  fill={partColors.arm_r}
                  stroke={getPartStroke('arm_r')}
                  strokeWidth={getPartStrokeWidth('arm_r')}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('arm_r')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.arm_r.name}: {partFp.arm_r.percent}%
                  </title>
                </rect>
                {/* Левая нога */}
                <rect
                  x="41"
                  y="59"
                  width="7"
                  height="31"
                  rx="1.5"
                  fill={partColors.leg_l}
                  stroke={getPartStroke('leg_l')}
                  strokeWidth={getPartStrokeWidth('leg_l')}
                  transform="rotate(15 44.5 59)"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('leg_l')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.leg_l.name}: {partFp.leg_l.percent}%
                  </title>
                </rect>
                {/* Правая нога */}
                <rect
                  x="52"
                  y="59"
                  width="7"
                  height="31"
                  rx="1.5"
                  fill={partColors.leg_r}
                  stroke={getPartStroke('leg_r')}
                  strokeWidth={getPartStrokeWidth('leg_r')}
                  transform="rotate(-15 55.5 59)"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPartKey('leg_r')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <title>
                    {partFp.leg_r.name}: {partFp.leg_r.percent}%
                  </title>
                </rect>
              </svg>

              {/* Всплывающий процент ФП прямо на кукле при наведении на часть тела */}
              {hoveredPartKey && partFp[hoveredPartKey] && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: HUD_CONFIG.status.paperDoll.badgeBg,
                    color: HUD_CONFIG.status.paperDoll.badgeText,
                    border: `1px solid ${HUD_CONFIG.status.paperDoll.badgeBorder}`,
                    borderRadius: '3px',
                    padding: '1px 5px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 5,
                    fontFamily: 'inherit',
                  }}
                >
                  {partFp[hoveredPartKey].percent}%
                </div>
              )}
            </>
          ) : (
            <span
              style={{
                fontSize: '11px',
                color: HUD_CONFIG.status.paperDoll.textEmpty,
                textAlign: 'center',
              }}
            >
              [НЕТ СХЕМЫ]
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
