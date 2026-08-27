import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_KEYS = new Set(["members", "deals", "gallery", "threads", "table-assignments"]);

export async function GET(_: NextRequest, { params }: { params: { key: string } }) {
  if (!PUBLIC_KEYS.has(params.key)) return NextResponse.json({ error: "Unknown state key" }, { status: 404 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  const { data, error } = await supabase.from("shared_site_state").select("payload,updated_at").eq("state_key", params.key).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payload: data?.payload ?? null, updatedAt: data?.updated_at ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: { key: string } }) {
  if (!PUBLIC_KEYS.has(params.key)) return NextResponse.json({ error: "Unknown state key" }, { status: 404 });
  if (request.cookies.get("nm_admin_auth")?.value !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  const payload = await request.json();
  const { data, error } = await supabase.from("shared_site_state").upsert({
    state_key: params.key,
    payload,
    updated_at: new Date().toISOString()
  }, { onConflict: "state_key" }).select("payload,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payload: data.payload, updatedAt: data.updated_at });
}
