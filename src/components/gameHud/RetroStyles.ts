import React from 'react';
import { HUD_CONFIG } from '../../config/hudConfig';

export const RETRO_FONT_FAMILY = "'WendyNeue', monospace";

export const RETRO_COLORS = HUD_CONFIG.retro;

export const RETRO_PANEL_STYLE: React.CSSProperties = {
  backgroundColor: RETRO_COLORS.bgPanel,
  border: `4px solid ${RETRO_COLORS.borderDark}`,
  boxShadow: `inset 4px 4px 0px ${RETRO_COLORS.borderLight}, inset -4px -4px 0px ${RETRO_COLORS.borderMedium}`,
  color: RETRO_COLORS.textDark,
  fontFamily: RETRO_FONT_FAMILY,
  textTransform: 'uppercase',
  userSelect: 'none',
  boxSizing: 'border-box',
};

export const RETRO_HEADER_STYLE: React.CSSProperties = {
  backgroundColor: '#383838',
  color: '#ffffff',
  padding: '4px 8px',
  fontSize: '15px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  fontFamily: RETRO_FONT_FAMILY,
  textTransform: 'uppercase',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '6px',
};

export const RETRO_SUNKEN_STYLE: React.CSSProperties = {
  backgroundColor: RETRO_COLORS.sunkenBg,
  borderTop: `4px solid ${RETRO_COLORS.sunkenBorderTopLeft}`,
  borderLeft: `4px solid ${RETRO_COLORS.sunkenBorderTopLeft}`,
  borderRight: `4px solid ${RETRO_COLORS.borderLight}`,
  borderBottom: `4px solid ${RETRO_COLORS.borderLight}`,
  fontFamily: RETRO_FONT_FAMILY,
  textTransform: 'uppercase',
  boxSizing: 'border-box',
};

export const RETRO_BUTTON_STYLE: React.CSSProperties = {
  backgroundColor: RETRO_COLORS.bgPanel,
  border: `4px solid ${RETRO_COLORS.borderDark}`,
  boxShadow: `inset 4px 4px 0px ${RETRO_COLORS.borderLight}, inset -4px -4px 0px ${RETRO_COLORS.borderMedium}`,
  color: RETRO_COLORS.textDark,
  fontFamily: RETRO_FONT_FAMILY,
  textTransform: 'uppercase',
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '6px 12px',
  cursor: 'pointer',
  outline: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

export const RETRO_BUTTON_PRESSED_STYLE: React.CSSProperties = {
  ...RETRO_BUTTON_STYLE,
  backgroundColor: '#727272',
  boxShadow: `inset 4px 4px 0px #303030, inset -2px -2px 0px ${RETRO_COLORS.borderLight}`,
};
