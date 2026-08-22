import { getAssetBucket } from "../../../../db";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "请选择素材文件" }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "支持 PNG、JPG、WebP、MP3、WAV、OGG 与 M4A" }, { status: 400 });
    if (file.size > 24 * 1024 * 1024) return Response.json({ error: "素材不能超过 24MB" }, { status: 400 });
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : file.type === "audio/mpeg" ? "mp3" : file.type === "audio/ogg" ? "ogg" : file.type.includes("mp4") || file.type.includes("m4a") ? "m4a" : "wav";
    const key = `em/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await getAssetBucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { originalName: file.name } });
    const url = new URL(request.url); url.search = ""; url.searchParams.set("key", key);
    return Response.json({ key, url: `${url.pathname}?${url.searchParams.toString()}` }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "图片上传失败" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !key.startsWith("em/")) return new Response("Not found", { status: 404 });
  const object = await getAssetBucket().get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
