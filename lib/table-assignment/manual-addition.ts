import type { AssignmentTable, Member } from "@/types/domain";

function identity(member: Member) {
  const number = member.memberNo?.trim();
  const name = member.name?.trim();
  return number && name ? JSON.stringify([number, name]) : null;
}

function isAssigned(tables: AssignmentTable[], member: Member) {
  const key = identity(member);
  return tables.some((table) => table.seats.some((seat) => seat.member && (
    seat.member.id === member.id || (key !== null && identity(seat.member) === key)
  )));
}

export function getUnassignedMembers(tables: AssignmentTable[], members: Member[]): Member[] {
  return members.filter((member) => member.status === "在籍" && !isAssigned(tables, member));
}

export function addMemberToTable(tables: AssignmentTable[], member: Member, tableName: string): AssignmentTable[] {
  if (member.status !== "在籍") throw new Error("在籍中の会員のみ追加できます。");
  if (isAssigned(tables, member)) throw new Error("この会員は既にテーブルに配置されています。");
  const target = tables.findIndex((table) => table.tableName === tableName);
  if (target < 0) throw new Error("追加先のテーブルが見つかりません。");
  return tables.map((table, index) => index === target ? {
    ...table,
    seats: [...table.seats, { member: { ...member }, isLeader: member.isTableLeader }]
  } : table);
}
