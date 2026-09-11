import { Point } from '../../types';

export interface PieMenuItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
  danger?: boolean;
  onSelect: () => void;
}

export interface PieMenuState {
  screenPos: Point;
  worldPos: Point;
  targetEntityId: string | null;
  targetEntityIds: string[];
}
