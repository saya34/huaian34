import { getRawDb } from "../../../../db";
import { parentEventId, validateEventDefinition } from "../../../em/event-validation";

type Status = "draft" | "published";

async function ensureTable() {
  const db = getRawDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS managed_events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      character_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      parent_event_id TEXT,
      priority INTEGER NOT NULL,
      status TEXT DEFAULT 'draft' NOT NULL,
      source_mode TEXT DEFAULT 'form' NOT NULL,
      definition_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_managed_events_character_status ON managed_events(character_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_managed_events_parent ON managed_events(parent_event_id)"),
  ]);
  return db;
}

function rowToEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    status: row.status,
    sourceMode: row.source_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    definition: JSON.parse(String(row.definition_json)),
  };
}

export async function GET(request: Request) {
  try {
    const db = await ensureTable();
    const status = new URL(request.url).searchParams.get("status");
    const query = status === "published"
      ? db.prepare("SELECT * FROM managed_events WHERE status = ? ORDER BY character_id, priority DESC, updated_at DESC").bind("published")
      : db.prepare("SELECT * FROM managed_events ORDER BY character_id, priority DESC, updated_at DESC");
    const result = await query.all<Record<string, unknown>>();
    return Response.json({ events: result.results.map(rowToEvent) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "事件库读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { definition?: unknown; status?: Status; sourceMode?: "form" | "json" };
    const checked = validateEventDefinition(payload.definition);
    if (!checked.valid || !checked.event) return Response.json({ error: "事件校验未通过", errors: checked.errors }, { status: 400 });
    const status: Status = payload.status === "published" ? "published" : "draft";
    const sourceMode = payload.sourceMode === "json" ? "json" : "form";
    const event = checked.event;
    const db = await ensureTable();
    const now = Date.now();
    await db.prepare(`INSERT INTO managed_events (
      id, title, character_id, scene_id, trigger, parent_event_id, priority, status, source_mode, definition_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, character_id=excluded.character_id, scene_id=excluded.scene_id,
      trigger=excluded.trigger, parent_event_id=excluded.parent_event_id, priority=excluded.priority,
      status=excluded.status, source_mode=excluded.source_mode, definition_json=excluded.definition_json,
      updated_at=excluded.updated_at`).bind(
        event.id, event.title, event.characterId, event.sceneId, event.trigger, parentEventId(event),
        event.priority, status, sourceMode, JSON.stringify(event), now, now,
      ).run();
    return Response.json({ event: { id: event.id, status, sourceMode, updatedAt: now, definition: event } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "事件保存失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return Response.json({ error: "缺少事件 ID" }, { status: 400 });
    const db = await ensureTable();
    await db.prepare("DELETE FROM managed_events WHERE id = ?").bind(id).run();
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "事件删除失败" }, { status: 500 });
  }
}
