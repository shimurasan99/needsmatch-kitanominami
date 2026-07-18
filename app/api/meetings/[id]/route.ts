import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Meeting } from "@/types/domain";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (request.cookies.get("nm_admin_auth")?.value !== "ok") return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "保存先が未設定です。" }, { status: 503 });
  const meeting = await request.json() as Meeting;
  const row = {
    meeting_key: params.id,
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
  const { data, error } = await supabase.from("managed_meetings").upsert(row, { onConflict: "meeting_key" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    id: data.meeting_key,
    title: data.title,
    date: data.meeting_date,
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    venueName: data.venue_name,
    venueAddress: data.venue_address,
    note: data.note,
    applicationDeadline: data.application_deadline,
    status: data.status
  });
}
