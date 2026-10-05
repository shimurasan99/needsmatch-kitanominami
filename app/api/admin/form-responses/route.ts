import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!await isAdminRequest(request)) return NextResponse.json({ error: "運営ログインが必要です。" }, { status: 401, headers });
  const db = createSupabaseServerClient(); if (!db) return NextResponse.json({ error: "保存先未設定" }, { status: 503, headers });
  const page = Number(new URL(request.url).searchParams.get("page") || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: "Invalid page" }, { status: 400, headers });
  const { data, error } = await db.from("shared_site_state").select("payload").like("state_key", "admin-form:%").order("state_key").range(page * 100, page * 100 + 100);
  if (error) return NextResponse.json({ error: "申込回答を読み込めませんでした。" }, { status: 500, headers });
  return NextResponse.json({ responses: (data ?? []).slice(0, 100).map(r => r.payload), hasMore: (data?.length ?? 0) > 100 }, { headers });
}
