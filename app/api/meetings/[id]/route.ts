import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/auth";
import { meetingFromRow, meetingToRow, validateMeeting } from "@/lib/data/meeting-record";
import type { Meeting } from "@/types/domain";

export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "運営ページから再度ログインしてください。" }, { status: 403 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const meeting = await request.json().catch(() => null) as Meeting;
  const invalid = validateMeeting(meeting);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const row = meetingToRow({ ...meeting, id: params.id });
  const { data, error } = meeting.updatedAt
    ? await supabase.from("managed_meetings").update(row).eq("meeting_key", params.id).eq("updated_at", meeting.updatedAt).select("*").maybeSingle()
    : await supabase.from("managed_meetings").insert(row).select("*").maybeSingle();
  if (error?.code === "23505" || (!error && !data)) return NextResponse.json({ error: "別の運営者が月例会を更新しました。再読み込みしてから保存してください。" }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "月例会を保存できませんでした。" }, { status: 500 });
  return NextResponse.json(meetingFromRow(data));
}
