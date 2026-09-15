import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRequest as isAdmin, isSignedInRequest as isSignedIn } from "@/lib/auth";
import type { StoredGuestEntry, StoredParticipantStatus } from "@/lib/data/participant-storage";

const allowedStatuses = new Set<StoredParticipantStatus>(["参加", "欠席", "未定", "キャンセル"]);
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isSignedIn(request))) return NextResponse.json({ error: "再度ログインしてください。" }, { status: 401 });
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
  return NextResponse.json({ statuses, guests: snapshot?.guests ?? [], updatedAt, guestsUpdatedAt: snapshot?.updated_at }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isSignedIn(request))) return NextResponse.json({ error: "再度ログインしてください。" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    memberId?: string;
    status?: StoredParticipantStatus;
    statuses?: Record<string, StoredParticipantStatus>;
    guests?: StoredGuestEntry[];
    guestsUpdatedAt?: string;
  };
  if (!body || typeof body !== "object") return NextResponse.json({ error: "出欠の入力内容を確認してください。" }, { status: 400 });
  if (body.guestsUpdatedAt && Number.isNaN(Date.parse(body.guestsUpdatedAt))) return NextResponse.json({ error: "ゲストの更新情報が正しくありません。" }, { status: 400 });
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

  if (!(await isAdmin(request))) return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  if (!body.statuses || typeof body.statuses !== "object" || Array.isArray(body.statuses) || Object.values(body.statuses).some(status => !allowedStatuses.has(status))) return NextResponse.json({ error: "出欠の入力内容を確認してください。" }, { status: 400 });
  if (body.guests !== undefined) {
    if (!Array.isArray(body.guests) || body.guests.some(guest => !guest?.id || typeof guest.name !== "string" || !guest.name.trim())) return NextResponse.json({ error: "ゲスト名を確認してください。" }, { status: 400 });
    const row = { meeting_key: params.id, guests: body.guests, updated_at: new Date(Math.max(Date.now(), body.guestsUpdatedAt ? Date.parse(body.guestsUpdatedAt) + 1 : 0)).toISOString() };
    const { data, error } = body.guestsUpdatedAt
      ? await supabase.from("attendance_snapshots").update(row).eq("meeting_key", params.id).eq("updated_at", body.guestsUpdatedAt).select("updated_at").maybeSingle()
      : await supabase.from("attendance_snapshots").insert(row).select("updated_at").maybeSingle();
    if (error?.code === "23505" || (!error && !data)) return NextResponse.json({ error: "別の運営者がゲスト情報を更新しました。再読み込みして保存してください。" }, { status: 409 });
    if (error) return NextResponse.json({ error: "ゲスト情報を保存できませんでした。" }, { status: 500 });
  }
  const rows = Object.entries(body.statuses)
    .filter(([, status]) => allowedStatuses.has(status))
    .map(([memberId, status]) => ({ meeting_key: params.id, member_key: memberId, status, updated_at: updatedAt }));
  const { error: responseError } = rows.length
    ? await supabase.from("attendance_responses").upsert(rows, { onConflict: "meeting_key,member_key" })
    : { error: null };
  if (responseError) return NextResponse.json({ error: "出欠を保存できませんでした。再読み込みして保存内容を確認してください。" }, { status: 500 });
  return NextResponse.json({ updatedAt });
}
