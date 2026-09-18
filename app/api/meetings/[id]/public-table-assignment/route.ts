import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { meetings as initialMeetings } from "@/lib/data/mock";
import { meetingFromRow } from "@/lib/data/meeting-record";
import { publicMeeting, publicPublication, type PublicMeetingTableResponse } from "@/lib/table-assignment/public-snapshot";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return reply({ error: "公開情報を読み込めませんでした。" }, 503);
  try {
    const { data: row, error } = await supabase.from("managed_meetings").select("*").eq("meeting_key", id).maybeSingle();
    if (error) return reply({ error: "公開情報を読み込めませんでした。" }, 500);
    const meeting = row ? meetingFromRow(row) : initialMeetings.find(meeting => meeting.id === id);
    if (!meeting || meeting.status === "下書き") return reply({ error: "対象の定例会が見つかりません。" }, 404);
    if (meeting.id !== id || !["確定", "終了"].includes(meeting.status)) throw new Error("Invalid meeting");
    const dto = publicMeeting(meeting);
    // Only the explicitly published state is read; draft/browser state is never used.
    const { data: shared, error: publicationError } = await supabase.from("shared_site_state").select("payload").eq("state_key", "table-assignments").maybeSingle();
    if (publicationError) return reply({ error: "公開情報を読み込めませんでした。" }, 500);
    let publication: PublicMeetingTableResponse["publication"] = null;
    if (shared) {
      const payload = shared.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid publication state");
      if (Object.hasOwn(payload, id)) publication = publicPublication(payload[id], id);
    }
    return reply({ meeting: dto, publication } satisfies PublicMeetingTableResponse);
  } catch {
    return reply({ error: "公開情報を読み込めませんでした。" }, 500);
  }
}
