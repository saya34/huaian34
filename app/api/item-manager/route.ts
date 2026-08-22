import { DEFAULT_RECIPE_RULES, ELEMENT_TYPES, ITEM_QUALITIES, ITEM_TABLE, RecipeRule } from "../../item-data";
import { getD1 } from "../../../db";

type ItemManagerRow = {
  draft_json: string;
  published_json: string;
  published_version: number;
  updated_at: string;
  published_at: string;
};

const DEFAULT_JSON = JSON.stringify(DEFAULT_RECIPE_RULES);

async function ensureState() {
  const db = await getD1();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS item_manager_state (
      id INTEGER PRIMARY KEY,
      draft_json TEXT NOT NULL,
      published_json TEXT NOT NULL,
      published_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO item_manager_state
      (id, draft_json, published_json, published_version)
    VALUES (1, ?, ?, 1)
  `).bind(DEFAULT_JSON, DEFAULT_JSON).run();
  return db;
}

async function readState() {
  const db = await ensureState();
  const row = await db.prepare(`
    SELECT draft_json, published_json, published_version, updated_at, published_at
    FROM item_manager_state
    WHERE id = 1
  `).first<ItemManagerRow>();
  if (!row) throw new Error("IM state is unavailable");
  return {
    draft: JSON.parse(row.draft_json) as RecipeRule[],
    published: JSON.parse(row.published_json) as RecipeRule[],
    version: row.published_version,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function normalizeRules(value: unknown): RecipeRule[] {
  if (!Array.isArray(value)) throw new Error("rules 必须是数组");
  if (value.length > 200) throw new Error("单次最多配置 200 条规则");
  const itemById = new Map(ITEM_TABLE.map((item) => [item.id, item]));
  const ids = new Set<string>();

  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`第 ${index + 1} 条规则格式错误`);
    const input = raw as Partial<RecipeRule>;
    const id = String(input.id ?? "").trim();
    const name = String(input.name ?? "").trim();
    const resultItemId = String(input.resultItemId ?? "").trim();
    if (!id || !name) throw new Error(`第 ${index + 1} 条规则缺少 id 或名称`);
    if (ids.has(id)) throw new Error(`规则 id 重复：${id}`);
    ids.add(id);
    const result = itemById.get(resultItemId);
    if (!result || result.itemType !== "product") throw new Error(`${name} 的结果必须是成品`);

    const requiredItems = Array.isArray(input.requiredItems) ? input.requiredItems.map((requirement) => {
      const itemId = String(requirement?.itemId ?? "").trim();
      const quantity = Math.max(1, Math.min(3, Math.floor(Number(requirement?.quantity ?? 1))));
      const item = itemById.get(itemId);
      if (!item || !item.canBeIngredient) throw new Error(`${name} 引用了不可炼制物品：${itemId}`);
      return { itemId, quantity };
    }) : [];

    const elementRequirements = Array.isArray(input.elementRequirements) ? input.elementRequirements.map((requirement) => {
      const element = requirement?.element;
      if (!ELEMENT_TYPES.includes(element!)) throw new Error(`${name} 包含未知属性条件`);
      return {
        element: element!,
        minCount: Math.max(1, Math.min(3, Math.floor(Number(requirement?.minCount ?? 1)))),
        additional: Boolean(requirement?.additional),
      };
    }) : [];

    const minMaterialCount = Math.max(1, Math.min(3, Math.floor(Number(input.minMaterialCount ?? 2))));
    if (!requiredItems.length && !elementRequirements.length) throw new Error(`${name} 至少需要一个材料或属性条件`);
    const minimumQuality = input.minimumQuality && ITEM_QUALITIES.includes(input.minimumQuality) ? input.minimumQuality : undefined;

    return {
      id,
      name,
      resultItemId,
      enabled: input.enabled !== false,
      priority: Math.max(0, Math.min(999, Math.floor(Number(input.priority ?? 100)))),
      weight: Math.max(1, Math.min(1000, Math.floor(Number(input.weight ?? 100)))),
      minMaterialCount,
      requiredItems,
      elementRequirements,
      minimumQuality,
    };
  });
}

export async function GET() {
  try {
    return Response.json(await readState(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "IM 读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { action?: string; rules?: unknown };
    const db = await ensureState();

    if (payload.action === "save-draft") {
      const rules = normalizeRules(payload.rules);
      await db.prepare(`
        UPDATE item_manager_state
        SET draft_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).bind(JSON.stringify(rules)).run();
    } else if (payload.action === "publish") {
      const rules = normalizeRules(payload.rules);
      await db.prepare(`
        UPDATE item_manager_state
        SET draft_json = ?, published_json = ?, published_version = published_version + 1,
            updated_at = CURRENT_TIMESTAMP, published_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).bind(JSON.stringify(rules), JSON.stringify(rules)).run();
    } else if (payload.action === "reset-defaults") {
      await db.prepare(`
        UPDATE item_manager_state
        SET draft_json = ?, published_json = ?, published_version = published_version + 1,
            updated_at = CURRENT_TIMESTAMP, published_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).bind(DEFAULT_JSON, DEFAULT_JSON).run();
    } else {
      return Response.json({ error: "未知操作" }, { status: 400 });
    }

    return Response.json(await readState());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "IM 写入失败" }, { status: 400 });
  }
}
