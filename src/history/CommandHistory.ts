import { ICommand } from './ICommand';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { EventBus } from '../core/EventBus';

export class CommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = EDITOR_CONFIG.historyMaxDepth) {
    this.maxDepth = maxDepth;
  }

  public push(command: ICommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    EventBus.emit('world:updated');
  }

  public undo(): ICommand | null {
    if (!this.canUndo()) return null;
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    EventBus.emit('world:updated');
    return command;
  }

  public redo(): ICommand | null {
    if (!this.canRedo()) return null;
    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);
    EventBus.emit('world:updated');
    return command;
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
