import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Meeting } from "@/types/domain";

function isSignedIn(request: NextRequest) {
  return request.cookies.get("nm_member_auth")?.value === "ok" || request.cookies.get("nm_admin_auth")?.value === "ok";
}

function isAdmin(request: NextRequest) {
  return request.cookies.get("nm_admin_auth")?.value === "ok";
}

function fromRow(row: Record<string, string>): Meeting {
  return {
    id: row.meeting_key,
    title: row.title,
    date: row.meeting_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    note: row.note,
    applicationDeadline: row.application_deadline,
    status: row.status as Meeting["status"]
  };
}

function toRow(meeting: Meeting) {
  return {
    meeting_key: meeting.id,
    title: meeting.title,
    meeting_date: meeting.date,
    start_time: meeting.startTime,
    end_time: meeting.endTime,
    venue_name: meeting.venueName,
    venue_address: meeting.venueAddress,
    note: meeting.note,
    application_deadline: meeting.applicationDeadline,
    status: meeting.status,
    updated_at: new Date().toISOString()
  };
}

export async function GET(request: NextRequest) {
  if (!isSignedIn(request)) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const { data, error } = await supabase.from("managed_meetings").select("*").order("meeting_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(fromRow));
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const input = await request.json() as Meeting;
  const meeting = { ...input, id: input.id || `meeting-${input.date}-${randomUUID().slice(0, 8)}` };
  const { data, error } = await supabase.from("managed_meetings").insert(toRow(meeting)).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(fromRow(data));
}
