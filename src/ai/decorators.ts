import { EntityAdapter } from '../EntityAdapter';
import { now_with_ms, vec2_distance_to } from '../utils';
import { BTDecorator, BTNode, NodeStatus } from './core';

export abstract class BTCondition extends BTDecorator {
  public static readonly nodeName = 'Условие';
  public static readonly description =
    'Если условие не выполняется, возвращает FAILURE, иначе передает управление дочернему узлу';

  private condition: (ctx: EntityAdapter) => boolean;

  constructor(condition: (ctx: EntityAdapter) => boolean, child: BTNode) {
    super(child);
    this.condition = condition;
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    if (!this.condition(ctx)) {
      if (this.child.isRunning()) {
        this.child.abort(ctx);
      }
      return NodeStatus.FAILURE;
    } else return this.child.tick(ctx);
  }
}

export class BTInverter extends BTDecorator {
  public static readonly nodeName = 'Инвертор';
  public static readonly description =
    'Инвертирует статус выполнения дочернего узла: SUCCESS меняет на FAILURE, FAILURE на SUCCESS';

  constructor(child: BTNode) {
    super(child);
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const status = this.child.tick(ctx);

    if (status === NodeStatus.SUCCESS) {
      return NodeStatus.FAILURE;
    }
    if (status === NodeStatus.FAILURE) {
      return NodeStatus.SUCCESS;
    }
    return status;
  }
}

export class BTRetry extends BTDecorator {
  public static readonly nodeName = 'Повторитель при неудаче';
  public static readonly description =
    'Повторяет выполнение дочернего узла при неудаче до тех пор, пока он не вернет SUCCESS';

  constructor(child: BTNode) {
    super(child);
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const status = this.child.tick(ctx);

    if (status === NodeStatus.FAILURE) {
      return NodeStatus.RUNNING;
    }

    return status;
  }
}

export class BTCooldown extends BTDecorator {
  public static readonly nodeName = 'Перезарядка';
  public static readonly description =
    'Блокирует повторное выполнение дочернего узла на заданное время (cooldownMs)';
  public static readonly defaultParams = { cooldownMs: 1000 };

  private params: typeof BTCooldown.defaultParams;
  private lastExecutionTime: number = -Infinity;

  constructor(
    child: BTNode,
    params?: Partial<typeof BTCooldown.defaultParams>
  ) {
    super(child);
    this.params = { ...BTCooldown.defaultParams, ...params };
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const currentTime = now_with_ms() * 1000;

    if (currentTime - this.lastExecutionTime < this.params.cooldownMs) {
      return NodeStatus.FAILURE;
    }

    const status = this.child.tick(ctx);

    if (status === NodeStatus.SUCCESS || status === NodeStatus.FAILURE) {
      this.lastExecutionTime = currentTime;
    }

    return status;
  }
}

export class BTRepeater extends BTDecorator {
  public static readonly nodeName = 'Повторитель';
  public static readonly description =
    'Бесконечно повторяет выполнение дочернего узла, игнорируя его завершение';

  constructor(child: BTNode) {
    super(child);
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const status = this.child.tick(ctx);

    if (status === NodeStatus.SUCCESS || status === NodeStatus.FAILURE) {
      return NodeStatus.RUNNING;
    }

    return status;
  }
}

export class BTDecoratorCheckEngaged extends BTDecorator {
  public static readonly nodeName = 'Проверка боя';
  public static readonly description =
    'Проверяет, находится ли цель на расстоянии ближе или равном engage_dist единицам, иначе прерывает дочерний узел';
  public static readonly defaultParams = { engage_dist: 1000 };

  private params: typeof BTDecoratorCheckEngaged.defaultParams;

  constructor(
    child: BTNode,
    params?: Partial<typeof BTDecoratorCheckEngaged.defaultParams>
  ) {
    super(child);
    this.params = { ...BTDecoratorCheckEngaged.defaultParams, ...params };
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const bb = ctx.brain!.blackboard;
    const target_id = bb.get('target_id');

    if (target_id === undefined) return NodeStatus.FAILURE;

    const target = ctx.utils.get_entity(target_id);

    if (!target?.getPos()) return NodeStatus.FAILURE;

    const dist = vec2_distance_to(
      ctx.getPos(),
      target.getPos()
    );
    const is_engaged = dist <= this.params.engage_dist;

    if (!is_engaged) {
      if (this.child.isRunning()) {
        this.child.abort(ctx);
      }
      return NodeStatus.FAILURE;
    }

    return this.child.tick(ctx);
  }
}

export class BTDecoratorIsTargetAlive extends BTDecorator {
  public static readonly nodeName = 'Цель жива';
  public static readonly description =
    'Проверяет наличие и статус жизни цели, прерывая выполнение при ее гибели';

  constructor(child: BTNode) {
    super(child);
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const target_id = ctx.brain!.blackboard.get('target_id');
    if (target_id === undefined) {
      if (this.child.isRunning()) this.child.abort(ctx);
      return NodeStatus.FAILURE;
    }

    const target = ctx.utils.get_entity(target_id);
    if (!target || !target.isAlive) {
      if (this.child.isRunning()) {
        this.child.abort(ctx);
      }
      return NodeStatus.FAILURE;
    }

    return this.child.tick(ctx);
  }
}