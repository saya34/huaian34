import { getAssetBucket, getD1 } from "../../../../db";
import { assertSameOrigin, cleanText, ForumRequestError, getVisitorHash, jsonError } from "../_shared";

const ALLOWED_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function POST(request: Request) {
  let uploadedKey = "";
  try {
    assertSameOrigin(request);
    const ownerHash = await getVisitorHash(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ForumRequestError("请选择一张留影。", 400);
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) throw new ForumRequestError("留影仅支持 JPG、PNG 或 WebP。", 415);
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new ForumRequestError("留影需小于 5MB。", 413);
    const db = await getD1();
    const now = Date.now();
    const recent = await db.prepare("SELECT COUNT(*) AS count FROM forum_media WHERE owner_hash = ? AND created_at > ?").bind(ownerHash, now - 10 * 60_000).first<{ count: number }>();
    if (Number(recent?.count ?? 0) >= 12) throw new ForumRequestError("留影上传太频繁了，请过一会儿再试。", 429);
    const id = `media_${crypto.randomUUID()}`;
    const month = new Date(now).toISOString().slice(0, 7);
    uploadedKey = `forum/${month}/${id}.${extension}`;
    const alt = cleanText(form.get("alt"), 80, "留影说明", true) || "道友上传的留影";
    const bucket = getAssetBucket();
    await bucket.put(uploadedKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { originalName: file.name.slice(0, 120) } });
    try {
      await db.prepare(`
        INSERT INTO forum_media (id, storage_key, content_type, byte_size, original_name, alt, owner_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, uploadedKey, file.type, file.size, file.name.slice(0, 120), alt, ownerHash, now).run();
    } catch (error) { await bucket.delete(uploadedKey); uploadedKey = ""; throw error; }
    return Response.json({ attachment: { kind: "image", mediaId: id, src: `/api/forum/media?id=${encodeURIComponent(id)}`, alt } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
