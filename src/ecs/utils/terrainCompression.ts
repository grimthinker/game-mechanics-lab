/**
 * Быстрое сжатие бинарного массива методом PackBits RLE.
 * Эффективно сжимает повторяющиеся байты (фоновую траву, пустые каналы и нули) в десятки раз.
 */
export function packBitsCompress(input: Uint8Array): Uint8Array {
  const output: number[] = [];
  const len = input.length;
  let i = 0;

  while (i < len) {
    let run = 1;
    while (i + run < len && input[i + run] === input[i] && run < 128) {
      run++;
    }

    if (run >= 3) {
      // Повторяющаяся цепочка: флаг от 129 до 254, затем повторяемый байт
      output.push((257 - run) & 0xff);
      output.push(input[i]);
      i += run;
    } else {
      // Литеральная цепочка неповторяющихся байтов
      const litStart = i;
      let litLen = 0;
      while (i < len && litLen < 128) {
        if (i + 2 < len && input[i] === input[i + 1] && input[i] === input[i + 2]) {
          break;
        }
        i++;
        litLen++;
      }
      // Литеральный флаг от 0 до 127, затем байты данных
      output.push(litLen - 1);
      for (let j = 0; j < litLen; j++) {
        output.push(input[litStart + j]);
      }
    }
  }

  return new Uint8Array(output);
}

/**
 * Распаковка массива PackBits RLE в исходный размер.
 */
export function packBitsDecompress(compressed: Uint8Array, expectedLength: number): Uint8Array {
  const output = new Uint8Array(expectedLength);
  let inIdx = 0;
  let outIdx = 0;
  const inLen = compressed.length;

  while (inIdx < inLen && outIdx < expectedLength) {
    const flag = compressed[inIdx++];
    if (flag <= 127) {
      const count = flag + 1;
      for (let k = 0; k < count && outIdx < expectedLength; k++) {
        output[outIdx++] = compressed[inIdx++];
      }
    } else if (flag > 128) {
      const count = 257 - flag;
      const val = compressed[inIdx++];
      for (let k = 0; k < count && outIdx < expectedLength; k++) {
        output[outIdx++] = val;
      }
    }
  }

  return output;
}

/**
 * Безопасное преобразование Uint8Array в Base64 частями (чанками по 16 КБ).
 * Исключает ошибку RangeError: Maximum call stack size exceeded на больших массивах.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 16384;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Преобразование строки Base64 обратно в Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
