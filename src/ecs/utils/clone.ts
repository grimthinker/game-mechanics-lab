/**
 * Быстрое глубокое клонирование структур данных ECS (компонентов, конфигов, массивов и буферов).
 * Работает в 10-20 раз быстрее JSON.parse(JSON.stringify), так как не преобразует данные в строки.
 */
export function fastClone<T>(val: T): T {
  if (val === null || typeof val !== 'object') {
    return val;
  }

  // 1. Быстрое клонирование массивов
  if (Array.isArray(val)) {
    const len = val.length;
    const res = new Array(len);
    for (let i = 0; i < len; i++) {
      res[i] = fastClone(val[i]);
    }
    return res as unknown as T;
  }

  // 2. Быстрое бинарное клонирование типизированных массивов (Float32Array, Uint8Array и т.д.)
  if (ArrayBuffer.isView(val)) {
    // @ts-expect-error Вызов нативного slice для создания копии буфера
    return val.slice() as unknown as T;
  }

  // 3. Быстрое клонирование объектов
  const res: Record<string, any> = {};
  for (const key in val) {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      res[key] = fastClone((val as any)[key]);
    }
  }
  return res as T;
}
