import { getAssetBucket, getD1 } from "../../../../db";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^media_[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const db = await getD1();
  const media = await db.prepare("SELECT storage_key, content_type FROM forum_media WHERE id = ?").bind(id).first<{ storage_key: string; content_type: string }>();
  if (!media) return new Response("Not found", { status: 404 });
  const object = await getAssetBucket().get(media.storage_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": media.content_type, "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff", ETag: object.httpEtag });
  return new Response(object.body, { headers });
}
