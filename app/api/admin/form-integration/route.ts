import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googleFormScript } from "@/lib/admin/google-form-script";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "保存先未設定" }, 503);
  const { data, error } = await db.from("shared_site_state").select("updated_at").eq("state_key", "admin-google-forms-secret").maybeSingle();
  if (error) return reply({ error: "連携状況を確認できませんでした。" }, 500);
  return reply({ configured: !!data, createdAt: data?.updated_at ?? null });
}
export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "保存先未設定" }, 503);
  const secret = randomBytes(32).toString("hex");
  const { error } = await db.from("shared_site_state").insert({ state_key: "admin-google-forms-secret", payload: { hash: createHash("sha256").update(secret).digest("hex") } });
  if (error?.code === "23505") return reply({ error: "連携キーは発行済みです。保存したスクリプトを使用してください。紛失時は連携キーの再設定が必要です。" }, 409);
  if (error) return reply({ error: "連携キーを作成できませんでした。" }, 500);
  return reply({ script: googleFormScript(secret) });
}
