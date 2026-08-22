import { getRawDb } from "../../../../db";
import { validateGift } from "../../../em/gift-validation";

async function table() {
  const db = getRawDb();
  await db.prepare(`CREATE TABLE IF NOT EXISTS managed_gifts (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,status TEXT DEFAULT 'draft' NOT NULL,source_mode TEXT DEFAULT 'form' NOT NULL,definition_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_managed_gifts_status ON managed_gifts(status)").run();
  return db;
}
const map = (row: Record<string, unknown>) => ({ id: row.id, status: row.status, sourceMode: row.source_mode, createdAt: row.created_at, updatedAt: row.updated_at, definition: JSON.parse(String(row.definition_json)) });
export async function GET(request: Request) {
  try { const db = await table(); const only = new URL(request.url).searchParams.get("status") === "published"; const result = await db.prepare(`SELECT * FROM managed_gifts${only ? " WHERE status='published'" : ""} ORDER BY updated_at DESC`).all(); return Response.json({ gifts: (result.results as Record<string, unknown>[]).map(map) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "礼物库读取失败" }, { status: 500 }); }
}
export async function POST(request: Request) {
  try { const payload = await request.json() as { definition?: unknown; status?: string; sourceMode?: string }; const checked = validateGift(payload.definition); if (!checked.valid || !checked.gift) return Response.json({ error: "礼物校验未通过", errors: checked.errors }, { status: 400 }); const db = await table(); const now = Date.now(); const status = payload.status === "published" ? "published" : "draft"; const mode = payload.sourceMode === "json" ? "json" : "form"; const gift = checked.gift; await db.prepare(`INSERT INTO managed_gifts (id,name,status,source_mode,definition_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,source_mode=excluded.source_mode,definition_json=excluded.definition_json,updated_at=excluded.updated_at`).bind(gift.id,gift.name,status,mode,JSON.stringify(gift),now,now).run(); return Response.json({ id: gift.id, status }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "礼物保存失败" }, { status: 500 }); }
}
export async function DELETE(request: Request) { try { const id = new URL(request.url).searchParams.get("id"); if (!id) return Response.json({ error: "缺少 ID" }, { status: 400 }); const db = await table(); await db.prepare("DELETE FROM managed_gifts WHERE id=?").bind(id).run(); return Response.json({ deleted: id }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 }); } }
