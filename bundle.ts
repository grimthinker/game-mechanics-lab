import { Glob } from 'bun';

const glob = new Glob('src/**/*.{ts,tsx}');
let result = '';
let count = 0;

// Список папок или подстрок, которые нужно игнорировать
const ignoreList = ['dist', 'node_modules', 'public'];

for (const file of glob.scanSync('.')) {
  // Проверяем, содержит ли путь что-то из списка игнорирования
  const shouldIgnore = ignoreList.some((ignore) => file.includes(ignore));

  if (shouldIgnore) {
    console.log(`Пропущено: ${file}`);
    continue;
  }

  const content = await Bun.file(file).text();
  result += `\n\n--- FILE: ${file} ---\n\n${content}`;
  count++;
}

const path = 'for_gemini/code.txt';
await Bun.write(path, result);
console.log(`Собрано файлов: ${count} -> ${path}`);
