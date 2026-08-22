import { getRawDb } from "../../../../db";
import { validateCharacter, validateScene } from "../../../em/content-validation";

type Kind = "character" | "scene";
type Status = "draft" | "published";

async function ensureTables() {
  const db = getRawDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS managed_characters (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, scene_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft' NOT NULL, source_mode TEXT DEFAULT 'form' NOT NULL,
      definition_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_managed_characters_scene_status ON managed_characters(scene_id, status)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS managed_scenes (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
      status TEXT DEFAULT 'draft' NOT NULL, source_mode TEXT DEFAULT 'form' NOT NULL,
      definition_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_managed_scenes_status ON managed_scenes(status)"),
  ]);
  return db;
}

function mapRow(row: Record<string, unknown>) {
  return { id: row.id, status: row.status, sourceMode: row.source_mode, createdAt: row.created_at, updatedAt: row.updated_at, definition: JSON.parse(String(row.definition_json)) };
}

export async function GET(request: Request) {
  try {
    const db = await ensureTables();
    const publishedOnly = new URL(request.url).searchParams.get("status") === "published";
    const suffix = publishedOnly ? " WHERE status = 'published'" : "";
    const [characters, scenes] = await db.batch([
      db.prepare(`SELECT * FROM managed_characters${suffix} ORDER BY updated_at DESC`),
      db.prepare(`SELECT * FROM managed_scenes${suffix} ORDER BY updated_at DESC`),
    ]);
    return Response.json({
      characters: (characters.results as Record<string, unknown>[]).map(mapRow),
      scenes: (scenes.results as Record<string, unknown>[]).map(mapRow),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容库读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { kind?: Kind; definition?: unknown; status?: Status; sourceMode?: "form" | "json" };
    if (payload.kind !== "character" && payload.kind !== "scene") return Response.json({ error: "kind 无效" }, { status: 400 });
    const db = await ensureTables(); const now = Date.now(); const status = payload.status === "published" ? "published" : "draft"; const sourceMode = payload.sourceMode === "json" ? "json" : "form";
    if (payload.kind === "character") {
      const checked = validateCharacter(payload.definition);
      const item = checked.character;
      if (!checked.valid || !item) return Response.json({ error: "内容校验未通过", errors: checked.errors }, { status: 400 });
      await db.prepare(`INSERT INTO managed_characters (id,name,scene_id,status,source_mode,definition_json,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,scene_id=excluded.scene_id,status=excluded.status,source_mode=excluded.source_mode,definition_json=excluded.definition_json,updated_at=excluded.updated_at`)
        .bind(item.id, item.name, item.sceneId, status, sourceMode, JSON.stringify(item), now, now).run();
      return Response.json({ id: item.id, status, sourceMode }, { status: 201 });
    } else {
      const checked = validateScene(payload.definition);
      const item = checked.scene;
      if (!checked.valid || !item) return Response.json({ error: "内容校验未通过", errors: checked.errors }, { status: 400 });
      await db.prepare(`INSERT INTO managed_scenes (id,name,status,source_mode,definition_json,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,source_mode=excluded.source_mode,definition_json=excluded.definition_json,updated_at=excluded.updated_at`)
        .bind(item.id, item.name, status, sourceMode, JSON.stringify(item), now, now).run();
      return Response.json({ id: item.id, status, sourceMode }, { status: 201 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "内容保存失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url); const kind = url.searchParams.get("kind"); const id = url.searchParams.get("id")?.trim();
    if ((kind !== "character" && kind !== "scene") || !id) return Response.json({ error: "参数不完整" }, { status: 400 });
    const db = await ensureTables();
    await db.prepare(`DELETE FROM ${kind === "character" ? "managed_characters" : "managed_scenes"} WHERE id = ?`).bind(id).run();
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
