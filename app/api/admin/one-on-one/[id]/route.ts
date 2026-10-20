import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAdminMembers } from "@/lib/admin/server-members";
import { MAX_ONE_ON_ONE_SIZE, ONE_ON_ONE_BUCKET, oneOnOneType } from "@/lib/admin/one-on-one";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
type Context = { params: Promise<{ id: string }> };
async function context(id: string) {
  const db = createSupabaseServerClient();
  if (!db) throw new Error("保存先が未設定です。");
  if (!(await readAdminMembers(db)).some(m => m.id === id)) throw new Error("会員が見つかりません。");
  return { db, folder: createHash("sha256").update(id).digest("hex") };
}
export async function GET(request: Request, { params }: Context) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  try {
    const { db, folder } = await context((await params).id);
    const bucket = await db.storage.getBucket(ONE_ON_ONE_BUCKET);
    if (bucket.error) {
      if (String(bucket.error.status) === "404" || /not found/i.test(bucket.error.message)) return reply({ files: [] });
      throw new Error("保管場所を確認できませんでした。");
    }
    if (bucket.data.public) throw new Error("保管場所の非公開設定を確認してください。");
    const file = new URL(request.url).searchParams.get("file");
    if (file) {
      if (!/^[0-9T-]+Z-[a-f0-9-]{36}\.(pdf|jpg|png|webp)$/.test(file)) return reply({ error: "ファイル名が不正です。" }, 400);
      const { data, error } = await db.storage.from(ONE_ON_ONE_BUCKET).createSignedUrl(`${folder}/${file}`, 60, { download: file });
      if (error || !data) throw new Error("ファイルを開けませんでした。");
      return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
    const { data, error } = await db.storage.from(ONE_ON_ONE_BUCKET).list(folder, { limit: 100, sortBy: { column: "name", order: "desc" } });
    if (error) throw new Error("一覧を読み込めませんでした。");
    return reply({ files: (data || []).filter(f => f.id).map(f => ({ name: f.name, createdAt: f.created_at, size: f.metadata?.size ?? 0 })) });
  } catch (e) { return reply({ error: e instanceof Error ? e.message : "読み込み失敗" }, 503); }
}
export async function POST(request: Request, { params }: Context) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "運営ページからアップロードしてください。" }, 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_ONE_ON_ONE_SIZE + 10000) return reply({ error: "3MB以下のファイルを選択してください。" }, 413);
  try {
    const { db, folder } = await context((await params).id);
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_ONE_ON_ONE_SIZE) return reply({ error: "3MB以下のPDF・画像を選択してください。" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer()), type = oneOnOneType(bytes);
    const existing = await db.storage.getBucket(ONE_ON_ONE_BUCKET);
    if (existing.error) {
      if (String(existing.error.status) !== "404" && !/not found/i.test(existing.error.message)) throw new Error("保管場所を確認できませんでした。");
      const created = await db.storage.createBucket(ONE_ON_ONE_BUCKET, { public: false, fileSizeLimit: MAX_ONE_ON_ONE_SIZE, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] });
      if (created.error) {
        const raced = await db.storage.getBucket(ONE_ON_ONE_BUCKET);
        if (raced.error || raced.data.public) throw new Error("非公開の保管場所を作成できませんでした。");
      }
    } else if (existing.data.public) throw new Error("保管場所が公開設定のため保存を中止しました。");
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.${type.extension}`;
    const { error } = await db.storage.from(ONE_ON_ONE_BUCKET).upload(`${folder}/${name}`, bytes, { contentType: type.mime, upsert: false });
    if (error) throw new Error("アップロードできませんでした。再度お試しください。");
    return reply({ saved: true, name }, 201);
  } catch (e) { return reply({ error: e instanceof Error ? e.message : "保存失敗" }, 503); }
}
