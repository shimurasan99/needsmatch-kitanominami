import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRequest, isSignedInRequest } from "@/lib/auth";

const PUBLIC_KEYS = new Set(["members", "deals", "gallery", "threads", "table-assignments"]);
const ALL_KEYS = new Set([...PUBLIC_KEYS, "table-assignment-drafts"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  if (!ALL_KEYS.has(params.key)) return NextResponse.json({ error: "Unknown state key" }, { status: 404 });
  if (params.key === "table-assignment-drafts" && !(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (["threads", "table-assignments"].includes(params.key) && !(await isSignedInRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  const { data, error } = await supabase.from("shared_site_state").select("payload,updated_at").eq("state_key", params.key).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payload: data?.payload ?? null, updatedAt: data?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  if (!ALL_KEYS.has(params.key)) return NextResponse.json({ error: "Unknown state key" }, { status: 404 });
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (params.key === "table-assignments") return NextResponse.json({ error: "公開機能が更新されました。ページを再読み込みし、テーブル割り画面から公開してください。" }, { status: 428 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  const version = request.headers.get("if-match");
  if (!version) return NextResponse.json({ error: "ページを再読み込みしてから、もう一度保存してください。" }, { status: 428 });
  if (version !== "new" && Number.isNaN(Date.parse(version))) return NextResponse.json({ error: "更新情報が正しくありません。再読み込みしてください。" }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "保存するデータの形式が正しくありません。" }, { status: 400 }); }
  if (payload === null || typeof payload !== "object") return NextResponse.json({ error: "保存内容が空です。" }, { status: 400 });
  const row = {
    state_key: params.key,
    payload,
    updated_at: new Date(Math.max(Date.now(), version === "new" ? 0 : new Date(version).getTime() + 1)).toISOString()
  };
  const { data, error } = version === "new"
    ? await supabase.from("shared_site_state").insert(row).select("payload,updated_at").maybeSingle()
    : await supabase.from("shared_site_state").update(row).eq("state_key", params.key).eq("updated_at", version).select("payload,updated_at").maybeSingle();
  if (error?.code === "23505" || (!error && !data)) return NextResponse.json({ error: "別の運営者が更新しました。最新の内容を読み込んでから保存してください。" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "保存できませんでした。" }, { status: 500 });
  return NextResponse.json({ payload: data.payload, updatedAt: data.updated_at });
}
