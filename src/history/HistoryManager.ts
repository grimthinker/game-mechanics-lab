export interface HistoryRecord {
  description: string;
  worldSnapshot: any;
  selectedEntityIds: string[];
  selectedEntityId: string | null;
}

export class HistoryManager {
  private undoStack: HistoryRecord[] = [];
  private redoStack: HistoryRecord[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  public pushState(record: HistoryRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(currentState: HistoryRecord): HistoryRecord | null {
    if (!this.canUndo()) return null;

    const previous = this.undoStack.pop()!;
    this.redoStack.push(currentState);
    return previous;
  }

  public redo(currentState: HistoryRecord): HistoryRecord | null {
    if (!this.canRedo()) return null;

    const next = this.redoStack.pop()!;
    this.undoStack.push(currentState);
    return next;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
