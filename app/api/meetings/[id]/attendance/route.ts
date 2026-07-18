import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoredGuestEntry, StoredParticipantStatus } from "@/lib/data/participant-storage";

const MEMBER_AUTH_COOKIE = "nm_member_auth";
const ADMIN_AUTH_COOKIE = "nm_admin_auth";
const allowedStatuses = new Set<StoredParticipantStatus>(["参加", "欠席", "未定", "キャンセル"]);

function isSignedIn(request: NextRequest) {
  return request.cookies.get(MEMBER_AUTH_COOKIE)?.value === "ok" || request.cookies.get(ADMIN_AUTH_COOKIE)?.value === "ok";
}

function isAdmin(request: NextRequest) {
  return request.cookies.get(ADMIN_AUTH_COOKIE)?.value === "ok";
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSignedIn(request)) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });

  const [{ data: responses, error: responseError }, { data: snapshot, error: snapshotError }] = await Promise.all([
    supabase.from("attendance_responses").select("member_key,status,updated_at").eq("meeting_key", params.id),
    supabase.from("attendance_snapshots").select("guests,updated_at").eq("meeting_key", params.id).maybeSingle()
  ]);
  if (responseError || snapshotError) {
    return NextResponse.json({ error: responseError?.message ?? snapshotError?.message }, { status: 500 });
  }

  const statuses = Object.fromEntries((responses ?? []).map((row) => [row.member_key, row.status]));
  const updatedAt = [...(responses ?? []).map((row) => row.updated_at), snapshot?.updated_at].filter(Boolean).sort().at(-1);
  return NextResponse.json({ statuses, guests: snapshot?.guests, updatedAt });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSignedIn(request)) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });

  const body = await request.json() as {
    memberId?: string;
    status?: StoredParticipantStatus;
    statuses?: Record<string, StoredParticipantStatus>;
    guests?: StoredGuestEntry[];
  };
  const updatedAt = new Date().toISOString();

  if (body.memberId && body.status && allowedStatuses.has(body.status)) {
    const { error } = await supabase.from("attendance_responses").upsert({
      meeting_key: params.id,
      member_key: body.memberId,
      status: body.status,
      updated_at: updatedAt
    }, { onConflict: "meeting_key,member_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updatedAt });
  }

  if (!isAdmin(request) || !body.statuses) return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  const rows = Object.entries(body.statuses)
    .filter(([, status]) => allowedStatuses.has(status))
    .map(([memberId, status]) => ({ meeting_key: params.id, member_key: memberId, status, updated_at: updatedAt }));
  const { error: responseError } = rows.length
    ? await supabase.from("attendance_responses").upsert(rows, { onConflict: "meeting_key,member_key" })
    : { error: null };
  const { error: snapshotError } = await supabase.from("attendance_snapshots").upsert({
    meeting_key: params.id,
    guests: Array.isArray(body.guests) ? body.guests : [],
    updated_at: updatedAt
  }, { onConflict: "meeting_key" });
  if (responseError || snapshotError) return NextResponse.json({ error: responseError?.message ?? snapshotError?.message }, { status: 500 });
  return NextResponse.json({ updatedAt });
}
