import * as Composites from './composites';
import * as Decorators from './decorators';
import * as Services from './services';
import * as Actions from './actions';
import { ALL_NODE_CATEGORIES, BTNode, NodeCategory } from './core';
import { BTServicePathUpdater } from './services';

export interface NodeTemplate {
    name: string;
    description: string;
    category: NodeCategory;
    defaultParams?: Record<string, any>;
}

interface BTNodeConstructor {
    nodeName: string;
    description: string;
    defaultParams?: Record<string, any>;
}

const BT_CLASSES: BTNodeConstructor[] = [
    Services.BTServicePathUpdater,
    Services.BTServiceFindNearestTarget,
    Services.BTServiceSyncStats,
];


/**
 * Создает базовый объект, где для каждой категории гарантированно есть пустой массив
 */
function createEmptyCategoryRecord(): Record<NodeCategory, NodeTemplate[]> {
    const record = {} as Record<NodeCategory, NodeTemplate[]>;
    for (const category of ALL_NODE_CATEGORIES) {
        record[category] = [];
    }
    return record;
}

/**
 * Группирует плоский список шаблонов по категориям
 */
export function groupTemplatesByCategory(
    templates: NodeTemplate[]
): Record<NodeCategory, NodeTemplate[]> {
    const grouped = createEmptyCategoryRecord();

    for (const template of templates) {
        if (template.category in grouped) {
            grouped[template.category].push(template);
        } else {
            // Защитный вариант (Defensive Programming):
            // Если в классе уже указана новая категория, но ее забыли добавить в ALL_NODE_CATEGORIES
            (grouped as Record<string, NodeTemplate[]>)[template.category] = [template];
        }
    }

    return grouped;
}

/**
 * Предикат (Type Guard): проверяет, что объект — это класс-наследник BTNode,
 * и что это конечный узел с заданным nodeName (а не промежуточный абстрактный класс).
 */
function isConcreteBTNodeClass(candidate: unknown): candidate is typeof BTNode {
    return (
        typeof candidate === "function" &&
        BTNode.isPrototypeOf(candidate) &&
        typeof (candidate as typeof BTNode).nodeName === "string" &&
        (candidate as typeof BTNode).nodeName.length > 0
    );
}

/**
 * Вспомогательная функция для извлечения всех NodeTemplate из объекта-модуля
 */
function extractNodeTemplates(moduleObj: Record<string, any>): NodeTemplate[] {
    return Object.values(moduleObj)
        .filter(isConcreteBTNodeClass)
        .map((NodeClass) => ({
            name: NodeClass.nodeName,
            description: NodeClass.description,
            category: NodeClass.category,
            defaultParams: NodeClass.defaultParams,
        }));
}

export const ALL_TEMPLATES: NodeTemplate[] = [
    ...extractNodeTemplates(Services),
    ...extractNodeTemplates(Composites),
    ...extractNodeTemplates(Actions),
    ...extractNodeTemplates(Decorators),
];

export const TEMPLATES_BY_CATEGORY: Record<NodeCategory, NodeTemplate[]> = 
    groupTemplatesByCategory(ALL_TEMPLATES);

// // Объединяем все импортированные классы
// export const ALL_NODE_CLASSES = [
//     ...Object.values(Composites),
//     ...Object.values(Decorators),
//     ...Object.values(Services),
//     ...Object.values(Actions),
// ];

// // Автоматически генерируем NODE_TEMPLATES
// export const NODE_TEMPLATES: NodeTemplate[] = ALL_NODE_CLASSES
//     // .filter((cls: any) => cls.name && cls.category) // Отфильтровываем базовые/абстрактные классы
//     .map((cls: any) => ({
//         name: cls.nodeName,
//         description: cls.description || '',
//         category: cls.category || 'Actions',
//         defaultParams: cls.defaultParams ? { ...cls.defaultParams } : undefined,
//     }));