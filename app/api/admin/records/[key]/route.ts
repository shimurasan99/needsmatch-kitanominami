import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAdminMembers } from "@/lib/admin/server-members";
import { defaultJoining, defaultRoutine } from "@/lib/admin/routine-defaults";
import { validMonth, validateAdminRecord } from "@/lib/admin/routine-record";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const allowed = (key: string) => key === "joining" || (key.startsWith("routines-") && validMonth(key.slice(9)));
type Context = { params: Promise<{ key: string }> };
export async function GET(request: Request, { params }: Context) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const { key } = await params;
  if (!allowed(key)) return reply({ error: "対象外です。" }, 404);
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "保存先未設定" }, 503);
  try {
    const { data, error } = await db.from("shared_site_state").select("payload,updated_at").eq("state_key", `admin-record:${key}`).maybeSingle();
    if (error) throw error;
    const payload = data?.payload ?? (key === "joining" ? defaultJoining(await readAdminMembers(db)) : defaultRoutine());
    return reply({ data: payload, version: data?.updated_at ?? null });
  } catch { return reply({ error: "読み込みに失敗しました。再読み込みしてください。" }, 503); }
}
export async function PUT(request: Request, { params }: Context) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const { key } = await params;
  if (!allowed(key)) return reply({ error: "対象外です。" }, 404);
  const version = request.headers.get("if-match");
  if (!version || (version !== "new" && Number.isNaN(Date.parse(version)))) return reply({ error: "再読み込みしてください。" }, 428);
  let payload;
  try { const raw = await request.text(); if (raw.length > 500000) throw new Error("データが大きすぎます。"); payload = validateAdminRecord(key, JSON.parse(raw)); }
  catch (e) { return reply({ error: e instanceof Error ? e.message : "入力を確認してください。" }, 400); }
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "保存先未設定" }, 503);
  const updated_at = new Date(Math.max(Date.now(), version === "new" ? 0 : Date.parse(version) + 1)).toISOString();
  const row = { state_key: `admin-record:${key}`, payload, updated_at };
  const { data, error } = version === "new"
    ? await db.from("shared_site_state").insert(row).select("payload,updated_at").maybeSingle()
    : await db.from("shared_site_state").update(row).eq("state_key", row.state_key).eq("updated_at", version).select("payload,updated_at").maybeSingle();
  if (error?.code === "23505" || (!error && !data)) return reply({ error: "別の運営者が更新しました。入力を控えてから再読み込みしてください。自動上書きはしていません。" }, 409);
  if (error || !data) return reply({ error: "保存できませんでした。入力は保持しています。" }, 503);
  return reply({ data: data.payload, version: data.updated_at });
}
