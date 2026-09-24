import { Point, Vec3 } from '../../types';

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
  worldPos: Vec3;
  targetEntityId: string | null;
  targetEntityIds: string[];
}
