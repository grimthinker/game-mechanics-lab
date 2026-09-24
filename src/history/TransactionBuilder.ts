import type { GameApp } from '../GameApp';
import { EntitySnapshotCommand } from './commands/EntitySnapshotCommand';
import { SerializedEntityData } from '../ecs/WorldSerializer';

export class TransactionBuilder {
  private beforeEntities: SerializedEntityData[] = [];
  private allAffectedIds = new Set<string>();
  private beforeSelection: { id: string | null; ids: string[] };

  constructor(
    private app: GameApp,
    private description: string
  ) {
    this.beforeSelection = {
      id: app.selection.selectedEntityId,
      ids: Array.from(app.selection.selectedEntityIds),
    };
  }

  /**
   * Захватывает состояние указанных сущностей и всей их иерархии (дети, инвентарь) ДО изменений.
   */
  public captureBefore(rootIds: string[]): void {
    const expandedIds = this.app.gatherHierarchyIds(rootIds);
    for (const id of expandedIds) {
      this.allAffectedIds.add(id);
    }
    this.beforeEntities = this.app.serializer.serializeEntities(Array.from(this.allAffectedIds));
  }

  /**
   * Вызывается после создания новых сущностей (Спавн, Клонирование), чтобы включить их в транзакцию.
   */
  public includeAdded(newRootIds: string[]): void {
    const expandedIds = this.app.gatherHierarchyIds(newRootIds);
    for (const id of expandedIds) {
      this.allAffectedIds.add(id);
    }
  }

  /**
   * Завершает транзакцию: делает слепок ПОСЛЕ изменений и пушит Команду в историю.
   */
  public commit(): void {
    const affectedArr = Array.from(this.allAffectedIds);
    const afterEntities = this.app.serializer.serializeEntities(affectedArr);

    const afterSelection = {
      id: this.app.selection.selectedEntityId,
      ids: Array.from(this.app.selection.selectedEntityIds),
    };

    const command = new EntitySnapshotCommand(
      this.description,
      this.app,
      affectedArr,
      this.beforeEntities,
      afterEntities,
      this.beforeSelection,
      afterSelection
    );

    this.app.commandHistory.push(command);
  }
}
