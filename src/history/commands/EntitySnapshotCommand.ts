import { ICommand } from '../ICommand';
import type { GameApp } from '../../GameApp';
import { SerializedEntityData } from '../../ecs/WorldSerializer';

export class EntitySnapshotCommand implements ICommand {
  constructor(
    public readonly description: string,
    private app: GameApp,
    private allAffectedIds: string[],
    private beforeEntities: SerializedEntityData[],
    private afterEntities: SerializedEntityData[],
    private beforeSelection: { id: string | null; ids: string[] },
    private afterSelection: { id: string | null; ids: string[] }
  ) {}

  public execute(): void {
    this.applyState(this.afterEntities, this.afterSelection);
  }

  public undo(): void {
    this.applyState(this.beforeEntities, this.beforeSelection);
  }

  private applyState(
    entitiesData: SerializedEntityData[],
    selection: { id: string | null; ids: string[] }
  ): void {
    // 1. Быстрое удаление всех затронутых сущностей из физики и мира перед накатом состояния
    for (const id of this.allAffectedIds) {
      if (this.app.world.getEntity(id)) {
        const phys = this.app.world.getComponent(id, 'physicsBody');
        if (phys) {
          if (phys.rawBody) this.app.physicsDriver.removeRigidBody(phys.rawBody);
        }
        this.app.world.removeEntity(id);
        this.app.aiSystem.unregisterEntity(id);
      }
    }

    // 2. Десериализация (восстановление) нужной версии сущностей из JSON-дампа
    if (entitiesData.length > 0) {
      this.app.serializer.deserializeEntities(entitiesData);
    }

    // 3. Восстановление правильного выделения
    this.app.selection.selectedEntityIds = new Set(selection.ids);
    this.app.selection.selectEntity(selection.id, false);

    // 4. Синхронизация вторичных систем и физических структур
    this.app.syncPhysicsStructures();
    this.app.selection.emitSelectionChanged();
  }
}
