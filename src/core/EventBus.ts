import { BTNodeDTO } from '../ai/core';

export interface EventMap {
  'selection:changed': {
    selectedEntityId: string | null;
    selectedEntityIds: string[];
  };
  'world:updated': void;
  'inventory:updated': void;
  'bt:updated': {
    btData: BTNodeDTO | null;
    btBlackboard: Record<string, any> | null;
    btSchema: Record<string, any> | null;
  };
  'game:playerDied': void;
  'inspector:navigate': {
    rootEntityId: string;
    path: Array<{ id: string; label: string }>;
    targetSection?: string;
  };
  'gizmo:dragging-changed': { isDragging: boolean };
  'gizmo:drag-update': {
    id: string;
    position: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
  };
}

type EventCallback<T> = (data: T) => void;

export class GameEventBus {
  private listeners = new Map<keyof EventMap, Set<EventCallback<any>>>();

  public on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.off(event, callback);
  }

  public off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    this.listeners.get(event)?.delete(callback);
  }

  public emit<K extends keyof EventMap>(
    ...args: EventMap[K] extends void ? [K] : [K, EventMap[K]]
  ): void {
    const [event, data] = args;
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const EventBus = new GameEventBus();
