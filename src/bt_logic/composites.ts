import { BTComposite, NodeStatus, EntityContext, BTNode, NodeCategory } from "./core";


export class BTSequence extends BTComposite {
    private currentChildIndex: number = 0;
    public static readonly nodeName = 'Последовательность';
    public static readonly description = 'Выполняет дочерние узлы по очереди слева направо до первой неудачи; возвращает SUCCESS, только если все дочерние узлы завершились успехом';

    constructor(children: BTNode[]) {
        super(children); 
    }

    protected onOpen(ctx: EntityContext): void {
        this.currentChildIndex = 0;
    }

    protected onTick(ctx: EntityContext): NodeStatus {
        for (let i = this.currentChildIndex; i < this.children.length; i++) {
            const status = this.children[i].tick(ctx);

            if (status === NodeStatus.RUNNING) {
                this.currentChildIndex = i;
                return NodeStatus.RUNNING;
            }

            if (status === NodeStatus.FAILURE) {
                return NodeStatus.FAILURE;
            }
        }
        return NodeStatus.SUCCESS;
    }

    protected onAbort(ctx: EntityContext): void {
        const activeChild = this.children[this.currentChildIndex];
        if (activeChild && activeChild.isRunning()) {
            activeChild.abort(ctx);
        }
    }

    protected onClose(ctx: EntityContext): void {
        this.currentChildIndex = 0;
    }
}

export class BTSelector extends BTComposite {
    private currentChildIndex: number = 0;
    public static readonly nodeName = 'Селектор';
    public static readonly description = 'Перебирает дочерние узлы слева направо до первого успешного выполнения; возвращает FAILURE, только если все дочерние узлы потерпели неудачу';

    constructor(children: BTNode[]) {
        super(children,); 
    }

    protected onOpen(ctx: EntityContext): void {
        this.currentChildIndex = 0;
    }

    protected onTick(ctx: EntityContext): NodeStatus {
        for (let i = this.currentChildIndex; i < this.children.length; i++) {
            const status = this.children[i].tick(ctx);

            if (status === NodeStatus.RUNNING) {
                this.currentChildIndex = i;
                return NodeStatus.RUNNING;
            }
            if (status === NodeStatus.SUCCESS) {
                return NodeStatus.SUCCESS;
            }
        }
        return NodeStatus.FAILURE;
    }

    protected onAbort(ctx: EntityContext): void {
        const activeChild = this.children[this.currentChildIndex];
        if (activeChild && activeChild.isRunning()) {
            activeChild.abort(ctx);
        }
    }
    
    protected onClose(ctx: EntityContext): void {
        this.currentChildIndex = 0;
    }
}