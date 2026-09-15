import type { AssignmentTable, Member } from "@/types/domain";

// Historical m-N ids were positional and were reassigned when the directory grew.
// Match both embedded identity fields, never the old id, number alone, or name alone.
export function reconcileTableMembers(tables: AssignmentTable[], members: Member[]) {
  const index = new Map<string, Member[]>();
  const identity = (member: Member) => {
    const number = member.memberNo?.trim();
    const name = member.name?.trim();
    return number && name ? JSON.stringify([number, name]) : null;
  };
  for (const member of members) {
    const key = identity(member);
    if (key) index.set(key, [...(index.get(key) ?? []), member]);
  }
  const currentIds = new Set(members.map((member) => member.id));
  const unresolved = new Set<string>();
  const result = tables.map((table) => ({ ...table, seats: table.seats.map((seat) => {
    if (!seat.member) return { ...seat };
    const key = identity(seat.member);
    const matches = key ? index.get(key) ?? [] : [];
    if (matches.length === 1) return { ...seat, member: { ...seat.member, id: matches[0].id } };
    unresolved.add(`${seat.member.name || "氏名不明"}（会員No.${seat.member.memberNo || "不明"}）`);
    let isolatedId = `history-unresolved:${encodeURIComponent(key ?? JSON.stringify([seat.member.memberNo, seat.member.name, seat.member.id]))}`;
    while (currentIds.has(isolatedId)) isolatedId += ":historical";
    return { ...seat, member: { ...seat.member, id: isolatedId } };
  }) }));
  return {
    tables: result,
    warning: unresolved.size ? `過去の会員情報 ${[...unresolved].join("、")} は会員番号と氏名の両方で現在の会員を一意に確認できません。別の会員として扱わず隔離しています。この履歴による同席確認は完全ではありません。内容の確認が必要です。` : ""
  };
}
