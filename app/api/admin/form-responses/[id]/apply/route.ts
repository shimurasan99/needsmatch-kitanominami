import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAdminMembers } from "@/lib/admin/server-members";
import { meetings } from "@/lib/data/mock";
import { meetingFromRow } from "@/lib/data/meeting-record";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return reply({ error: "運営ログインが必要です。" }, 401);
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return reply({ error: "回答IDが不正です。" }, 400);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.meetingId !== "string" || typeof body.memberId !== "string") return reply({ error: "対象の月例会と参加区分を選択してください。" }, 400);
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "保存先未設定" }, 503);
  try {
    const { data: row, error } = await db.from("managed_meetings").select("*").eq("meeting_key", body.meetingId).maybeSingle();
    if (error) throw new Error("月例会を確認できませんでした。");
    const meeting = row ? meetingFromRow(row) : meetings.find(m => m.id === body.meetingId);
    if (!meeting || meeting.status === "下書き") return reply({ error: "対象の月例会が見つかりません。" }, 400);
    if (body.memberId && !(await readAdminMembers(db)).some(m => m.id === body.memberId)) return reply({ error: "会員が見つかりません。" }, 400);
    const { data, error: applyError } = await db.rpc("apply_google_form_response", { p_source_id: id, p_meeting_key: body.meetingId, p_meeting_date: meeting.date, p_member_key: body.memberId, p_expected_version: body.expectedVersion ?? null, p_expected_guests_at: body.guestsUpdatedAt ?? null });
    if (applyError?.code === "40001") return reply({ error: "出欠が別の画面で変更されました。最新情報を確認してから追加してください。" }, 409);
    if (applyError?.code === "23505") return reply({ error: "同じ氏名・会社のゲストが登録済みです。参加者名簿を確認してください。" }, 409);
    if (applyError) return reply({ error: "名簿への反映ができませんでした。連携用DB設定と申込内容を確認してください。" }, 500);
    if (!data?.applied) return reply({ error: "反映結果を確認できませんでした。回答を再読み込みしてください。" }, 500);
    return reply(data);
  } catch { return reply({ error: "情報を確認できませんでした。時間をおいて再度お試しください。" }, 500); }
}
