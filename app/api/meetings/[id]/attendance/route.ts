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
  const versions = Object.fromEntries((responses ?? []).map((row) => [row.member_key, row.updated_at]));
  const updatedAt = [...(responses ?? []).map((row) => row.updated_at), snapshot?.updated_at].filter(Boolean).sort().at(-1);
  return NextResponse.json({ statuses, versions, guests: snapshot?.guests ?? [], updatedAt, guestsUpdatedAt: snapshot?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
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
    guestsUpdatedAt?: string | null;
    expectedVersions?: Record<string, string | null>;
  };
  if (!body || typeof body !== "object") return NextResponse.json({ error: "出欠の入力内容を確認してください。" }, { status: 400 });
  if (body.guestsUpdatedAt !== undefined && body.guestsUpdatedAt !== null
    && (typeof body.guestsUpdatedAt !== "string" || Number.isNaN(Date.parse(body.guestsUpdatedAt)))) return NextResponse.json({ error: "ゲストの更新情報が正しくありません。" }, { status: 400 });
  const memberWrite = typeof body.memberId === "string" && !!body.memberId.trim() && body.status !== undefined;
  if (!memberWrite && !(await isAdmin(request))) return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  const statuses = memberWrite ? { [body.memberId!]: body.status! } : body.statuses;
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses) || Object.entries(statuses).some(([id, status]) => !id.trim() || !allowedStatuses.has(status))) return NextResponse.json({ error: "出欠の入力内容を確認してください。" }, { status: 400 });
  if (!body.expectedVersions || typeof body.expectedVersions !== "object" || Array.isArray(body.expectedVersions)
    || Object.keys(statuses).some(id => !Object.hasOwn(body.expectedVersions!, id))) {
    return NextResponse.json({ error: "古い画面からの保存を停止しました。ページを再読み込みして最新の回答を確認してください。" }, { status: 428 });
  }
  if (Object.values(body.expectedVersions).some(value => value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value))))) return NextResponse.json({ error: "出欠の更新情報が正しくありません。再読み込みしてください。" }, { status: 400 });
  if (memberWrite && body.guests !== undefined) return NextResponse.json({ error: "管理者画面からゲストを編集してください。" }, { status: 403 });
  if (body.guests !== undefined) {
    if (!Array.isArray(body.guests) || body.guests.some(guest => !guest?.id || typeof guest.name !== "string" || !guest.name.trim())) return NextResponse.json({ error: "ゲスト名を確認してください。" }, { status: 400 });
    if (body.guests.some(guest => guest.status !== undefined && guest.status !== "参加" && guest.status !== "欠席")) return NextResponse.json({ error: "ゲストの出欠は参加または欠席を選択してください。" }, { status: 400 });
    if (!Object.hasOwn(body, "guestsUpdatedAt")) return NextResponse.json({ error: "ゲスト情報を再読み込みしてから保存してください。" }, { status: 428 });
  }
  const { data, error } = await supabase.rpc("save_attendance_atomic", {
    p_meeting_key: params.id, p_statuses: statuses, p_expected_versions: body.expectedVersions,
    p_guests: body.guests ?? null, p_expected_guests_at: body.guestsUpdatedAt ?? null
  });
  if (error?.code === "40001") return NextResponse.json({ error: "別の画面で出欠またはゲストが変更されました。保存は行っていません。再読み込みして最新の内容を確認してください。" }, { status: 409 });
  if (error) return NextResponse.json({ error: "出欠を保存できませんでした。入力内容を保持しています。時間をおいて再度お試しください。" }, { status: 500 });
  if (!data || typeof data !== "object") return NextResponse.json({ error: "保存結果を確認できませんでした。" }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
