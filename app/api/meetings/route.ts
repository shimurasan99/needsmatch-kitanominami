import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/auth";
import { meetingFromRow, meetingToRow, validateMeeting } from "@/lib/data/meeting-record";
import type { Meeting } from "@/types/domain";
import { meetings as initialMeetings } from "@/lib/data/mock";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const { data, error } = await supabase.from("managed_meetings").select("*").order("meeting_date");
  if (error) return NextResponse.json({ error: "月例会を読み込めませんでした。" }, { status: 500 });
  const merged = new Map(initialMeetings.map((meeting) => [meeting.id, meeting]));
  for (const row of data ?? []) {
    const meeting = meetingFromRow(row);
    merged.set(meeting.id, meeting);
  }
  const isAdmin = await isAdminRequest(request);
  const meetings = [...merged.values()].filter((meeting) => isAdmin || meeting.status !== "下書き").sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json(meetings, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "運営ページから再度ログインしてください。" }, { status: 403 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const input = await request.json().catch(() => null) as Meeting;
  const invalid = validateMeeting(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const meeting = { ...input, id: input.id || `meeting-${input.date}-${randomUUID().slice(0, 8)}` };
  const { data, error } = await supabase.from("managed_meetings").insert(meetingToRow(meeting)).select("*").single();
  if (error) return NextResponse.json({ error: "月例会を保存できませんでした。" }, { status: 500 });
  return NextResponse.json(meetingFromRow(data));
}
