import { World } from '../ecs/World';

export interface IModelPreview {
  /** Инициализация области предпросмотра внутри переданного контейнера */
  init(container: HTMLDivElement): void;

  /** Асинхронная загрузка рига существа и (опционально) прикрепление частей тела */
  loadRig(structureType: string, assemblyPartIds?: string[], world?: World): Promise<void>;

  /** Запуск анимации по ее строковому ключу */
  playAnimation(animName: string): void;

  /** Изменение скорости воспроизведения */
  setSpeed(speed: number): void;

  /** Обновление размеров (вызывается из ResizeObserver) */
  resize(width: number, height: number): void;

  /** Очистка ресурсов, слушателей и остановка цикла рендера */
  destroy(): void;
}
