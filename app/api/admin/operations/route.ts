import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyOperations, validateOperations } from "@/lib/admin/operations";

export const dynamic = "force-dynamic";
const KEY = "admin-operations-v1";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const db = createSupabaseServerClient();
  if (!db) return reply({ error: "保存先が未設定です。" }, 503);
  const { data, error } = await db.from("shared_site_state").select("payload,updated_at").eq("state_key", KEY).maybeSingle();
  if (error) return reply({ error: "運営データを読み込めませんでした。" }, 500);
  return reply({ data: data?.payload ?? emptyOperations(), version: data?.updated_at ?? null });
}
export async function PUT(request: Request) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const db = createSupabaseServerClient();
  if (!db) return reply({ error: "保存先が未設定です。" }, 503);
  const version = request.headers.get("if-match");
  if (!version || (version !== "new" && Number.isNaN(Date.parse(version)))) return reply({ error: "最新の情報を読み込んでから保存してください。" }, 428);
  let payload;
  try { const raw = await request.text(); if (raw.length > 2_000_000) throw new Error("データが大きすぎます。"); payload = validateOperations(JSON.parse(raw)); }
  catch (cause) { return reply({ error: cause instanceof Error ? cause.message : "入力内容を確認してください。" }, 400); }
  const updated_at = new Date(Math.max(Date.now(), version === "new" ? 0 : Date.parse(version) + 1)).toISOString();
  const row = { state_key: KEY, payload, updated_at };
  const { data, error } = version === "new"
    ? await db.from("shared_site_state").insert(row).select("payload,updated_at").maybeSingle()
    : await db.from("shared_site_state").update(row).eq("state_key", KEY).eq("updated_at", version).select("payload,updated_at").maybeSingle();
  if (error?.code === "23505" || (!error && !data)) return reply({ error: "別の運営者が更新しました。入力内容は保持しています。変更内容を控えてから最新情報を再読み込みしてください。" }, 409);
  if (error || !data) return reply({ error: "保存できませんでした。入力内容を保持しています。" }, 500);
  return reply({ data: data.payload, version: data.updated_at });
}
