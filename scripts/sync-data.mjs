import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = resolve(root, "garbage.json");
const outputPath = resolve(root, "garbage-data.js");
const requiredFields = ["id", "name", "category", "keywords", "suggestion", "reason", "note", "scene"];
const allowedCategories = new Set(["可回收物", "有害垃圾", "厨余垃圾", "其他垃圾"]);
const allowedScenes = new Set(["宿舍", "食堂", "快递站", "教室"]);

const records = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(records) || records.length < 100) {
  throw new Error("garbage.json 必须是数组，且至少包含 100 条数据。");
}

const ids = new Set();
const names = new Set();
for (const [index, item] of records.entries()) {
  const missing = requiredFields.filter((field) => item[field] === undefined || item[field] === "");
  if (missing.length) throw new Error(`第 ${index + 1} 条缺少字段：${missing.join("、")}`);
  if (!Array.isArray(item.keywords) || !item.keywords.length) throw new Error(`“${item.name}”至少需要一个关键词。`);
  if (!allowedCategories.has(item.category)) throw new Error(`“${item.name}”的分类无效：${item.category}`);
  if (!allowedScenes.has(item.scene)) throw new Error(`“${item.name}”的场景无效：${item.scene}`);
  if (ids.has(item.id)) throw new Error(`id 重复：${item.id}`);
  if (names.has(item.name)) throw new Error(`名称重复：${item.name}`);
  ids.add(item.id);
  names.add(item.name);
}

const output = `/* 由 scripts/sync-data.mjs 根据 garbage.json 生成，请勿手工修改。 */\nwindow.GARBAGE_DATA = ${JSON.stringify(records, null, 2)};\n`;
await writeFile(outputPath, output, "utf8");
console.log(`Validated and synced ${records.length} records.`);
