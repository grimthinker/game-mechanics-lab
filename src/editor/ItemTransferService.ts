import { GameApp } from '../GameApp';
import { TransactionBuilder } from '../history/TransactionBuilder';
import {
  TransferTarget,
  findItemLocation,
  validateItemTransfer,
} from '../ecs/utils/itemValidation';
import { CollisionCategory, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from '../ecs/types';
import RAPIER from '@dimforge/rapier3d-compat';

export class ItemTransferService {
  constructor(private app: GameApp) {}

  public transferItem(itemId: string, target: TransferTarget): boolean {
    const world = this.app.world;
    const source = findItemLocation(world, itemId);
    if (!source) return false;

    // Исключаем лишние вызовы, если предмет перенесли в ту же самую ячейку
    if (JSON.stringify(source) === JSON.stringify(target)) {
      return false;
    }

    const validation = validateItemTransfer(world, itemId, target);
    if (!validation.valid) return false;

    const tx = new TransactionBuilder(this.app, 'Перемещение предмета');
    const affectedIds = new Set<string>([itemId]);

    // Сохраняем состояние источников и приемников для Undo/Redo
    if (source.type === 'slot') affectedIds.add(source.partId);
    if (source.type === 'area') affectedIds.add(source.containerId);
    if (source.type === 'inventory') affectedIds.add(source.containerId);

    if (target.type === 'slot') affectedIds.add(target.partId);
    if (target.type === 'area') affectedIds.add(target.containerId);
    if (target.type === 'inventory') affectedIds.add(target.containerId);

    if (validation.isSwap && validation.swapItemId) {
      affectedIds.add(validation.swapItemId);
    }

    tx.captureBefore(Array.from(affectedIds));

    // Выполнение перемещения / обмена
    if (validation.isSwap && validation.swapItemId) {
      this.removeItem(validation.swapItemId, target);
      this.removeItem(itemId, source);

      this.placeItem(itemId, target, source);
      this.placeItem(validation.swapItemId, source, target);
    } else {
      this.removeItem(itemId, source);
      this.placeItem(itemId, target, source);
    }

    // Если перемещенный предмет был выбран на холсте, а теперь попал в экипировку/инвентарь:
    // снимаем с него выделение, чтобы не оставался фантомный фокус
    if (target.type !== 'ground' && this.app.selection.selectedEntityId === itemId) {
      this.app.selection.deselectEntity(itemId);
    }
    if (
      validation.isSwap &&
      validation.swapItemId &&
      source.type !== 'ground' &&
      this.app.selection.selectedEntityId === validation.swapItemId
    ) {
      this.app.selection.deselectEntity(validation.swapItemId);
    }

    this.app.attachmentSystem.update(world, this.app.physics);
    tx.commit();
    this.app.captureBaseState();
    return true;
  }

  private removeItem(itemId: string, location: TransferTarget): void {
    const world = this.app.world;
    if (location.type === 'slot') {
      const slot = world.getComponent(location.partId, 'interactionSlots');
      if (slot && slot.itemId === itemId) slot.itemId = null;
    } else if (location.type === 'area') {
      const equip = world.getComponent(location.containerId, 'equip');
      if (equip) {
        const area = equip.equipmentAreas.find((a) => a.id === location.areaId);
        if (area) {
          area.itemIds = area.itemIds.filter((id) => id !== itemId);
        }
      }
    } else if (location.type === 'inventory') {
      const inv = world.getComponent(location.containerId, 'inventory');
      if (inv) {
        if (location.row !== undefined && location.col !== undefined) {
          const cell = inv.slots[location.row]?.[location.col];
          if (cell && cell.itemId === itemId) {
            cell.itemId = null;
            cell.count = 0;
          }
        } else {
          for (let r = 0; r < inv.slots.length; r++) {
            for (let c = 0; c < inv.slots[r].length; c++) {
              if (inv.slots[r][c].itemId === itemId) {
                inv.slots[r][c].itemId = null;
                inv.slots[r][c].count = 0;
              }
            }
          }
        }
      }
    } else if (location.type === 'ground') {
      const physBody = world.getComponent(itemId, 'physicsBody');
      if (physBody) {
        if (physBody.rawBody) {
          this.app.physicsDriver.removeRigidBody(physBody.rawBody);
        }
        world.removeComponent(itemId, 'physicsBody');
      }
    }
    world.removeComponent(itemId, 'ownership');
    const renderable = world.getComponent(itemId, 'renderable');
    if (renderable) renderable.isVisible = false;
  }

  private placeItem(itemId: string, location: TransferTarget, source?: TransferTarget): void {
    const world = this.app.world;
    const item = world.getComponent(itemId, 'item');
    if (!item) return;

    if (location.type === 'slot') {
      const slot = world.getComponent(location.partId, 'interactionSlots');
      if (slot) slot.itemId = itemId;
      world.addComponent(itemId, 'ownership', { ownerId: location.partId, status: 'equipped' });
    } else if (location.type === 'area') {
      const equip = world.getComponent(location.containerId, 'equip');
      if (equip) {
        const area = equip.equipmentAreas.find((a) => a.id === location.areaId);
        if (area && !area.itemIds.includes(itemId)) {
          area.itemIds.push(itemId);
        }
      }
      world.addComponent(itemId, 'ownership', {
        ownerId: location.containerId,
        status: 'equipped',
      });
    } else if (location.type === 'inventory') {
      const inv = world.getComponent(location.containerId, 'inventory');
      if (inv) {
        let placed = false;
        if (location.row !== undefined && location.col !== undefined) {
          const cell = inv.slots[location.row]?.[location.col];
          if (cell && !cell.itemId) {
            cell.itemId = itemId;
            cell.count = item.count;
            placed = true;
          }
        }
        if (!placed) {
          for (let r = 0; r < inv.slots.length; r++) {
            for (let c = 0; c < inv.slots[r].length; c++) {
              if (!inv.slots[r][c].itemId) {
                inv.slots[r][c].itemId = itemId;
                inv.slots[r][c].count = item.count;
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
        }
      }
      world.addComponent(itemId, 'ownership', {
        ownerId: location.containerId,
        status: 'inventory',
      });
    } else if (location.type === 'ground') {
      const transform = world.getComponent(itemId, 'transform');
      let posX = location.position?.x ?? transform?.x;
      let posY = location.position?.y ?? transform?.y;
      let posZ = (location.position as any)?.z ?? transform?.z;

      if (location.parentEntityId) {
        const parentTrans = world.getComponent(location.parentEntityId, 'transform');
        if (parentTrans) {
          posX = parentTrans.x;
          posY = parentTrans.y;
          posZ = parentTrans.z ?? 0;
        }
      }

      if ((posX === undefined || posY === undefined) && source) {
        if (source.type === 'slot') {
          const sTrans = world.getComponent(source.partId, 'transform');
          if (sTrans) {
            posX = sTrans.x;
            posY = sTrans.y;
            posZ = sTrans.z ?? 0;
          }
        } else if (source.type === 'area' || source.type === 'inventory') {
          const sTrans = world.getComponent(source.containerId, 'transform');
          if (sTrans) {
            posX = sTrans.x;
            posY = sTrans.y;
            posZ = sTrans.z ?? 0;
          }
        }
      }

      const defaultX = this.app.camera.targetX ?? 0;
      const defaultY = (this.app.camera.targetY ?? 0) + 1.0;
      const defaultZ = this.app.camera.targetZ ?? 0;

      posX = posX ?? defaultX;
      posY = posY ?? defaultY;
      posZ = posZ ?? defaultZ;

      if (transform) {
        transform.x = posX;
        transform.y = posY;
        transform.z = posZ;
      } else {
        world.addComponent(itemId, 'transform', {
          x: posX,
          y: posY,
          z: posZ,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          angle: 0,
        });
      }

      const physStats = world.getComponent(itemId, 'physicsStats');
      if (physStats) {
        const radius = physStats.radius.current ?? 0.3;
        const weight = physStats.weight.current ?? 1;

        const mask = physStats.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

        // Нативное 3D Dynamic тело Rapier
        let rawBody: RAPIER.RigidBody | undefined;
        let rawCollider: RAPIER.Collider | undefined;

        if (this.app.physicsDriver && this.app.physicsDriver.isReady) {
          const pos3D = { x: posX, y: posY ?? 1.5, z: posZ };
          rawBody = this.app.physicsDriver.createDynamicBody(pos3D, itemId);
          rawCollider = this.app.physicsDriver.createBallCollider(radius, rawBody, weight);
          rawCollider.setRestitution(0.3);
        }

        world.addComponent(itemId, 'physicsBody', {
          rawBody,
          rawCollider,
          bodyType: 'dynamic',
          isStatic: false,
          category: CollisionCategory.ITEM,
          mask,
        });
      }
      const renderable = world.getComponent(itemId, 'renderable');
      if (renderable) renderable.isVisible = true;
    }
  }
}
