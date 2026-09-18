export type PublicMeetingTableResponse = {
  meeting: { id: string; title: string; date: string; startTime: string; endTime: string; venueName: string };
  publication: { publishedAt: string; tables: { tableName: string; seats: { name: string; description: string; isLeader: boolean }[] }[] } | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public snapshot");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid public snapshot text");
  return value;
}

// Construct an allowlisted DTO, never spread stored member/meeting objects.
export function publicMeeting(value: unknown): PublicMeetingTableResponse["meeting"] {
  const source = record(value);
  const date = text(source.date), startTime = text(source.startTime), endTime = text(source.endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date
    || ![startTime, endTime].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || endTime <= startTime) throw new Error("Invalid public meeting date");
  return { id: text(source.id), title: text(source.title), date, startTime, endTime, venueName: text(source.venueName) };
}

export function publicPublication(value: unknown, meetingId: string): NonNullable<PublicMeetingTableResponse["publication"]> {
  const source = record(value);
  const publishedAt = text(source.publishedAt);
  if (source.meetingId !== meetingId || Number.isNaN(Date.parse(publishedAt)) || !Array.isArray(source.tables) || !source.tables.length) throw new Error("Invalid publication");
  const tables = source.tables.map(value => {
    const table = record(value);
    if (!Array.isArray(table.seats)) throw new Error("Invalid seats");
    return { tableName: text(table.tableName), seats: table.seats.map(value => {
      const seat = record(value);
      const member = seat.member == null ? null : record(seat.member);
      if (typeof seat.isLeader !== "boolean") throw new Error("Invalid leader flag");
      for (const item of [member?.name, member?.industry, seat.guestName, seat.guestCompany]) {
        if (item !== undefined && typeof item !== "string") throw new Error("Invalid seat text");
      }
      return { name: text(member?.name || seat.guestName), description: text(member ? member.industry || "業種未登録" : seat.guestCompany || "ゲスト"), isLeader: seat.isLeader };
    }) };
  });
  if (new Set(tables.map(table => table.tableName)).size !== tables.length) throw new Error("Duplicate table names");
  return { publishedAt, tables };
}
