import { validDate } from "@/lib/admin/operations";
import type { Member } from "@/types/domain";

export type RoutineTask = { id: string; title: string; owner: string; timing: string; dueDate: string; completedDate: string; done: boolean; note: string };
export type RoutineRecord = { tasks: RoutineTask[] };
export type JoiningRecord = { members: { memberId: string; joinedMonth: string; source: string }[] };
export const validMonth = (s: string) => /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(s);
export function compareMemberNumber(a: Pick<Member, "memberNo" | "name">, b: Pick<Member, "memberNo" | "name">) {
  const number = (s: string) => { const value = s.normalize("NFKC").trim().replace(/^NM[-\s]*/i, ""); return /^\d+$/.test(value) ? Number(value) : Infinity; };
  const x = number(a.memberNo), y = number(b.memberNo);
  return x === y ? a.name.localeCompare(b.name, "ja") : x < y ? -1 : 1;
}
export function validateAdminRecord(key: string, value: unknown): RoutineRecord | JoiningRecord {
  if (!value || typeof value !== "object") throw new Error("入力内容を確認してください。");
  const text = (v: unknown, max = 1000) => { if (typeof v !== "string" || v.length > max) throw new Error("文字数を確認してください。"); return v.trim(); };
  const date = (v: unknown) => { const s = text(v, 10); if (s && !validDate(s)) throw new Error("日付を確認してください。"); return s; };
  const list = key === "joining" ? (value as JoiningRecord).members : (value as RoutineRecord).tasks;
  if (!Array.isArray(list) || list.length > 2000 || list.some(r => !r || typeof r !== "object")) throw new Error("入力形式を確認してください。");
  const ids = list.map(r => text("memberId" in r ? r.memberId : r.id, 200));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error("IDの重複があります。");
  if (key === "joining") return { members: (list as JoiningRecord["members"]).map(r => {
    const joinedMonth = text(r.joinedMonth, 7);
    if (joinedMonth && !validMonth(joinedMonth)) throw new Error("入会月を確認してください。");
    return { memberId: text(r.memberId, 200), joinedMonth, source: text(r.source) };
  }) };
  return { tasks: (list as RoutineTask[]).map(r => {
    const title = text(r.title, 300);
    if (!title || typeof r.done !== "boolean") throw new Error("タスク名・完了状況を確認してください。");
    return { id: text(r.id, 200), title, owner: text(r.owner, 200), timing: text(r.timing, 300), dueDate: date(r.dueDate), completedDate: date(r.completedDate), done: r.done, note: text(r.note, 4000) };
  }) };
}
