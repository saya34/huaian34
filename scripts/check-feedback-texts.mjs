import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), "app", "game", "feedback", "content");
const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
const owners = new Map();
const errors = [];
for (const file of files) {
  let content;
  try { content = JSON.parse(await readFile(join(directory, file), "utf8")); }
  catch (error) { errors.push(`${file}: JSON 解析失败 ${error.message}`); continue; }
  for (const [key, value] of Object.entries(content)) {
    if (owners.has(key)) errors.push(`${key}: 同时存在于 ${owners.get(key)} 与 ${file}`);
    owners.set(key, file);
    if (typeof value !== "string" || value.trim() === "") errors.push(`${file}:${key}: 文案必须是非空字符串`);
    const opens = (String(value).match(/\{/g) ?? []).length;
    const closes = (String(value).match(/\}/g) ?? []).length;
    if (opens !== closes || /\{[^\w.}]+\}/.test(String(value))) errors.push(`${file}:${key}: 占位符格式错误`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`feedback text check passed: ${owners.size} keys in ${files.length} files`);
