import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "運営ページから再度ログインしてください。" }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null);
  const validRevision = (value: unknown) => typeof value === "string" && value.length <= 64 && !Number.isNaN(Date.parse(value));
  if (!id || !input || !validRevision(input.expectedSavedRevision) || !(input.expectedPublishedRevision === null || validRevision(input.expectedPublishedRevision))) {
    return NextResponse.json({ error: "保存・公開の更新情報が正しくありません。再読み込みして保存してください。" }, { status: 400 });
  }
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const { data, error } = await supabase.rpc("publish_table_assignment", {
    p_meeting_id: id,
    p_expected_draft_revision: input.expectedSavedRevision,
    p_expected_publication_revision: input.expectedPublishedRevision
  });
  if (error?.message?.includes("NM_TABLE_CONFLICT")) return NextResponse.json({ error: "別の運営者が保存または公開内容を更新しました。再読み込みして確認してから公開してください。" }, { status: 409 });
  if (error?.code === "PGRST202" || error?.code === "42883") return NextResponse.json({ error: "公開機能のデータベース更新（006）が必要です。運営管理者へお知らせください。" }, { status: 503 });
  if (error?.code === "22023") return NextResponse.json({ error: "公開できる保存済みテーブル割りがありません。先に内容を保存してください。" }, { status: 400 });
  if (error || !data?.publication) return NextResponse.json({ error: "公開できませんでした。再読み込みして公開状況を確認してください。" }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
