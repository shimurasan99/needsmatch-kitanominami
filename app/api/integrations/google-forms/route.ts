import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFormResponse, FORM_SHEET_ID, FORM_TAB_ID } from "@/lib/admin/form-response";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret.length < 32 || secret.length > 200) return reply({ error: "Unauthorized" }, 401);
  const db = createSupabaseServerClient();
  if (!db) return reply({ error: "Unavailable" }, 503);
  const { data: setting, error: settingError } = await db.from("shared_site_state").select("payload").eq("state_key", "admin-google-forms-secret").maybeSingle();
  if (settingError) return reply({ error: "Unavailable" }, 503);
  const expected = setting?.payload?.hash;
  const actual = createHash("sha256").update(secret).digest("hex");
  if (typeof expected !== "string" || expected.length !== actual.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return reply({ error: "Unauthorized" }, 401);
  let payload;
  try { const raw = await request.text(); if (raw.length > 100_000) throw new Error("Too large"); payload = parseFormResponse(JSON.parse(raw)); }
  catch { return reply({ error: "回答形式が変わっています。連携の列設定を確認してください。" }, 400); }
  // Stable even if old rows move. Retrying never restores an old answer over HP edits.
  const { sourceRow: _row, ...identity } = payload;
  const id = createHash("sha256").update(`${FORM_SHEET_ID}:${FORM_TAB_ID}:${JSON.stringify(identity)}`).digest("hex");
  const { error } = await db.from("shared_site_state").insert({ state_key: `admin-form:${id}`, payload: { ...payload, sourceId: id, receivedAt: new Date().toISOString() } });
  if (error?.code === "23505") return reply({ accepted: true, duplicate: true });
  if (error) return reply({ error: "保存できませんでした。再送してください。" }, 503);
  return reply({ accepted: true });
}
