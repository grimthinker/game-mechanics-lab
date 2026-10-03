import React, { useEffect, useRef } from 'react';
import { Camera } from '../../Camera';
import { RETRO_PANEL_STYLE, RETRO_SUNKEN_STYLE } from './RetroStyles';
import { angleDifference, normalizeAngle } from '../../utils';
import { HUD_CONFIG } from '../../config/hudConfig';

export interface BlockCompassProps {
  camera: Camera | null | undefined;
}

const CARDINALS = [
  { label: 'С', deg: 0 },
  { label: 'СВ', deg: 45 },
  { label: 'В', deg: 90 },
  { label: 'ЮВ', deg: 135 },
  { label: 'Ю', deg: 180 },
  { label: 'ЮЗ', deg: 225 },
  { label: 'З', deg: 270 },
  { label: 'СЗ', deg: 315 },
];

export const BlockCompass: React.FC<BlockCompassProps> = ({ camera }) => {
  const viewWidth = 440;
  const pixelsPerDegree = 1.8;

  const ribbonRef = useRef<HTMLDivElement | null>(null);

  // Состояние инерции и физики стрелки компаса
  const targetAngleRadRef = useRef<number>(0);
  const currentAngleRadRef = useRef<number>(0);
  const angularVelocityRef = useRef<number>(0);

  // 1. Опрос реального направления камеры раз в 0.2 секунды
  useEffect(() => {
    const updateTarget = () => {
      if (camera) {
        // Вектор взгляда камеры в горизонтальной плоскости XZ
        const viewRad = normalizeAngle(camera.yaw + Math.PI);
        targetAngleRadRef.current = viewRad;
      }
    };

    updateTarget();
    const interval = setInterval(updateTarget, 200); // Опрос раз в 0.2 сек
    return () => clearInterval(interval);
  }, [camera]);

  // 2. Анимационный цикл: плавный поворот с физической инерцией и колебанием магнитной стрелки
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const animateCompass = (now: number) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      // Кратчайшая разница углов в диапазоне [-PI, PI]
      const diff = angleDifference(targetAngleRadRef.current, currentAngleRadRef.current);

      // Пружинно-демпферная модель компаса (Spring-Damper Physics)
      const springK = 38.0; // Сила магнитного притяжения стрелки
      const damping = 7.5; // Вязкое затухание в жидкости компаса

      const accel = diff * springK - angularVelocityRef.current * damping;
      angularVelocityRef.current += accel * dt;

      currentAngleRadRef.current = normalizeAngle(
        currentAngleRadRef.current + angularVelocityRef.current * dt
      );

      // Перевод в градусы 0..360
      let deg = (currentAngleRadRef.current * 180) / Math.PI;
      if (deg < 0) deg += 360;

      if (ribbonRef.current) {
        ribbonRef.current.style.transform = `translateX(${-deg * pixelsPerDegree}px)`;
      }

      rafId = requestAnimationFrame(animateCompass);
    };

    rafId = requestAnimationFrame(animateCompass);
    return () => cancelAnimationFrame(rafId);
  }, [pixelsPerDegree]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        width: viewWidth,
        height: 48,
        ...RETRO_PANEL_STYLE,
        padding: '6px 10px',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...RETRO_SUNKEN_STYLE,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Центральный фиксированный маркер */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: HUD_CONFIG.compass.centerMarker,
            transform: 'translateX(-50%)',
            zIndex: 3,
          }}
        />

        {/* Скользящая лента сторон света */}
        <div
          ref={ribbonRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 0,
            display: 'flex',
            alignItems: 'center',
            transform: 'translateX(0px)',
            willChange: 'transform',
          }}
        >
          {[-1, 0, 1].map((loop) => (
            <React.Fragment key={loop}>
              {/* Метки каждые 15 градусов */}
              {Array.from({ length: 24 }).map((_, i) => {
                const deg = i * 15;
                const offset = (loop * 360 + deg) * pixelsPerDegree;
                const isMajor = deg % 45 === 0;

                return (
                  <div
                    key={`tick_${loop}_${deg}`}
                    style={{
                      position: 'absolute',
                      left: offset,
                      top: isMajor ? 2 : 7,
                      bottom: isMajor ? 2 : 7,
                      width: isMajor ? 2 : 1,
                      backgroundColor: isMajor
                        ? HUD_CONFIG.compass.majorTick
                        : HUD_CONFIG.compass.minorTick,
                    }}
                  />
                );
              })}

              {/* Буквенные обозначения сторон света */}
              {CARDINALS.map((c) => {
                const offset = (loop * 360 + c.deg) * pixelsPerDegree;
                const isMainCardinal = c.deg % 90 === 0;

                return (
                  <span
                    key={`cardinal_${loop}_${c.deg}`}
                    style={{
                      position: 'absolute',
                      left: offset,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: isMainCardinal ? '18px' : '14px',
                      fontWeight: 'bold',
                      color: isMainCardinal
                        ? HUD_CONFIG.compass.mainCardinalText
                        : HUD_CONFIG.compass.secondaryCardinalText,
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                      pointerEvents: 'none',
                    }}
                  >
                    {c.label}
                  </span>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
