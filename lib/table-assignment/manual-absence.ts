import type { AssignmentSeat, AssignmentTable, Member } from "@/types/domain";
import { fetchStoredParticipants, saveAllParticipants, saveMemberAttendance, type StoredParticipants } from "@/lib/data/participant-storage";
import { reconcileTableMembers } from "@/lib/table-assignment/member-identity";

export async function markSeatAbsent(meetingId: string, seat: AssignmentSeat, members: Member[]): Promise<{ participants: StoredParticipants | null; attendanceUpdated: boolean }> {
  if (!meetingId.trim()) throw new Error("対象の定例会を確認してください。");
  const latest = await fetchStoredParticipants(meetingId);
  if (seat.member) {
    const resolved = reconcileTableMembers([{ tableName: "確認", seats: [seat] }], members);
    const id = resolved.tables[0].seats[0].member?.id;
    if (resolved.warning || !id || members.filter(member => member.id === id).length !== 1) {
      throw new Error("会員番号と氏名から対象の会員を確認できません。最新の会員情報を確認してください。配置は変更していません。");
    }
    const participants = await saveMemberAttendance(meetingId, id, "欠席", latest?.versions?.[id] ?? null);
    return { participants, attendanceUpdated: true };
  }
  const name = seat.guestName?.trim();
  const company = seat.guestCompany?.trim() ?? "";
  if (!name) throw new Error("対象のゲストを確認できません。配置は変更していません。");
  const matches = (latest?.guests ?? []).filter(guest => guest.name.trim() === name && (guest.company || guest.branchName || guest.type || "").trim() === company);
  if (matches.length > 1) throw new Error("同じ氏名・会社名のゲストが複数いるため、対象を確認できません。参加者管理で確認してください。配置は変更していません。");
  if (!matches.length) return { participants: latest, attendanceUpdated: false };
  const matched = matches[0];
  if (!matched.id || latest!.guests!.filter(guest => guest.id === matched.id).length !== 1) throw new Error("ゲストの登録情報が重複しています。参加者管理で確認してください。");
  const guests = latest!.guests!.map(guest => guest === matched ? { ...guest, status: "欠席" as const } : guest);
  const participants = await saveAllParticipants(meetingId, { statuses: {}, expectedVersions: {}, guests, guestsUpdatedAt: latest?.guestsUpdatedAt ?? null });
  return { participants, attendanceUpdated: true };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function removeSeatFromTable(tables: AssignmentTable[], tableName: string, index: number, expectedSeat: AssignmentSeat): AssignmentTable[] {
  const targets = tables.filter(table => table.tableName === tableName);
  const target = targets[0];
  if (targets.length !== 1 || !Number.isInteger(index) || index < 0 || !target?.seats[index]
    || JSON.stringify(stableValue(target.seats[index])) !== JSON.stringify(stableValue(expectedSeat))) {
    throw new Error("対象の配置が変更されています。最新のテーブル割りを確認してください。");
  }
  return tables.map(table => table === target ? { ...table, seats: table.seats.filter((_, seatIndex) => seatIndex !== index) } : table);
}
