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

export function addGuestToTable(tables: AssignmentTable[], guestName: string, guestCompany: string, tableName: string): AssignmentTable[] {
  const name = guestName.trim();
  const company = guestCompany.trim();
  if (!name) throw new Error("ゲストの氏名を入力してください。");
  if (name.length > 100 || company.length > 100) throw new Error("氏名・会社名はそれぞれ100文字以内で入力してください。");
  if (tables.some((table) => table.seats.some((seat) => !seat.member && seat.guestName?.trim() === name && (seat.guestCompany?.trim() ?? "") === company))) {
    throw new Error("同じ氏名・会社名のゲストは既にテーブルに配置されています。");
  }
  const target = tables.findIndex((table) => table.tableName === tableName);
  if (target < 0) throw new Error("追加先のテーブルが見つかりません。");
  return tables.map((table, index) => index === target ? {
    ...table,
    seats: [...table.seats, { guestName: name, guestCompany: company, isLeader: false }]
  } : table);
}

function incrementLabel(label: string) {
  const letters = label.split("");
  for (let index = letters.length - 1; index >= 0; index--) {
    if (letters[index] !== "Z") {
      letters[index] = String.fromCharCode(letters[index].charCodeAt(0) + 1);
      return letters.join("");
    }
    letters[index] = "A";
  }
  return `A${letters.join("")}`;
}

export function nextTableName(tables: AssignmentTable[]): string {
  let maximum = "";
  const names = new Set(tables.map((table) => table.tableName));
  for (const name of names) {
    const label = /^([A-Z]+)テーブル$/.exec(name)?.[1];
    if (label && (label.length > maximum.length || (label.length === maximum.length && label > maximum))) maximum = label;
  }
  let next = incrementLabel(maximum);
  while (names.has(`${next}テーブル`)) next = incrementLabel(next);
  return `${next}テーブル`;
}

export function addEmptyTable(tables: AssignmentTable[]): AssignmentTable[] {
  return [...tables, { tableName: nextTableName(tables), seats: [] }];
}
