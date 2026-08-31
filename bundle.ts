import { Glob } from "bun";

const glob = new Glob("src/**/*.{ts,tsx}");
let result = "";
let count = 0;

for (const file of glob.scanSync(".")) {
  const content = await Bun.file(file).text();
  result += `\n\n--- FILE: ${file} ---\n\n${content}`;
  count++;
}
const path = "for_gemini/code.txt";
await Bun.write(path, result);
console.log(`Собрано файлов: ${count} -> ${path}`);