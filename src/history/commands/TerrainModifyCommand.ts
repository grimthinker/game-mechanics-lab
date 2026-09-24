import { ICommand } from '../ICommand';
import type { GameApp } from '../../GameApp';

export class TerrainModifyCommand implements ICommand {
  constructor(
    public readonly description: string,
    private app: GameApp,
    private entityId: string,
    private beforeHeights: Float32Array,
    private afterHeights: Float32Array,
    private beforeSplat: Uint8Array,
    private afterSplat: Uint8Array
  ) {}

  public execute(): void {
    this.applyState(this.afterHeights, this.afterSplat);
  }

  public undo(): void {
    this.applyState(this.beforeHeights, this.beforeSplat);
  }

  private applyState(heights: Float32Array, splatData: Uint8Array): void {
    const comp = this.app.world.getComponent(this.entityId, 'terrain');
    if (comp) {
      // Восстанавливаем данные
      comp.heights.set(heights);
      comp.splatData.set(splatData);

      // Сигнализируем системам о необходимости перестроить геометрию, текстуру и коллайдер
      comp.isGeometryDirty = true;
      comp.isSplatDirty = true;
      comp.isPhysicsDirty = true;

      // Принудительно вызываем обновление физики (важно для отката на паузе)
      this.app.syncPhysicsStructures();
    }
  }
}
