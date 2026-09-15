import type { Meeting } from "@/types/domain";

export function meetingFromRow(row: Record<string, string>): Meeting {
  return { id: row.meeting_key, title: row.title, date: row.meeting_date,
    startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5),
    venueName: row.venue_name, venueAddress: row.venue_address, note: row.note,
    applicationDeadline: row.application_deadline, status: row.status as Meeting["status"], updatedAt: row.updated_at };
}

export function meetingToRow(meeting: Meeting) {
  return { meeting_key: meeting.id, title: meeting.title.trim(), meeting_date: meeting.date,
    start_time: meeting.startTime, end_time: meeting.endTime, venue_name: meeting.venueName.trim(),
    venue_address: meeting.venueAddress, note: meeting.note ?? "", application_deadline: meeting.applicationDeadline,
    status: meeting.status, updated_at: new Date(Math.max(Date.now(), meeting.updatedAt ? Date.parse(meeting.updatedAt) + 1 : 0)).toISOString() };
}

export function validateMeeting(value: unknown): string | null {
  if (!value || typeof value !== "object") return "月例会の入力内容を確認してください。";
  const m = value as Meeting;
  if (m.updatedAt && Number.isNaN(Date.parse(m.updatedAt))) return "月例会の更新情報が正しくありません。";
  const date = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (typeof m.title !== "string" || !m.title.trim() || typeof m.venueName !== "string" || !m.venueName.trim()) return "月例会名と会場を入力してください。";
  if (!date(m.date) || !date(m.applicationDeadline)) return "開催日と回答期限を入力してください。";
  if (![m.startTime, m.endTime].every(t => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || m.startTime >= m.endTime) return "終了時刻は開始時刻より後に設定してください。";
  if (m.applicationDeadline > m.date) return "回答期限は開催日以前に設定してください。";
  if (!["下書き", "確定", "終了"].includes(m.status)) return "月例会の状態が正しくありません。";
  if (typeof m.venueAddress !== "string") return "会場住所の入力内容を確認してください。";
  return null;
}
