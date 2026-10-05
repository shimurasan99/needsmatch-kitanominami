import type { Member } from "@/types/domain";

export const COURSES = ["スタートアップ", "商談", "フロントエンド", "テーブルリーダー", "集客", "運営"] as const;
export const TRAINING_STATUSES = ["未確認", "未受講", "今後受講予定", "受講済"] as const;
export type Course = typeof COURSES[number];
export type TrainingStatus = typeof TRAINING_STATUSES[number];
export type MemberNote = { id: string; memberId: string; memberNo: string; name: string; company: string; industry: string; attribute: string; industryDetail: string; desiredPartners: string; oneOnOneUrl: string; facebookUrl: string; note: string };
export type Training = { id: string; memberId: string; memberNo: string; name: string; courses: Record<Course, { status: TrainingStatus; date: string }>; sourceAsOf: string; note: string };
export type Seminar = { id: string; month: string; memberIds: string[]; presenterNames: string; status: "予定" | "終了" | "要確認"; title: string; note: string };
export type Operations = { memberNotes: MemberNote[]; training: Training[]; seminars: Seminar[]; sourceNote: string };
export const emptyOperations = (): Operations => ({ memberNotes: [], training: [], seminars: [], sourceNote: "" });
export const emptyCourses = (): Training["courses"] => Object.fromEntries(COURSES.map(name => [name, { status: "未確認", date: "" }])) as Training["courses"];
export const normalizeName = (value: string) => value.normalize("NFKC").replace(/[\s\u3000]/g, "");
export function matchMember(members: Member[], number: string, name: string) {
  // Never match solely on number: the source contains duplicate NM IDs.
  if (!normalizeName(name)) return undefined;
  const byName = members.filter(m => normalizeName(m.name) === normalizeName(name));
  const exact = byName.filter(m => m.memberNo.trim() === number.trim());
  return exact.length === 1 ? exact[0] : byName.length === 1 ? byName[0] : undefined;
}
function string(value: unknown, limit = 4000): string {
  if (typeof value !== "string" || value.length > limit) throw new Error("文字数・入力形式を確認してください。");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("入力形式を確認してください。");
  return value as Record<string, unknown>;
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 2000) throw new Error("行数・入力形式を確認してください。");
  const result = value.map(object);
  const ids = result.map(r => string(r.id, 200));
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) throw new Error("行IDが空欄または重複しています。");
  return result;
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeHttpUrl(value: string) {
  if (!value) return "";
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? value : ""; } catch { return ""; }
}
export function validateOperations(value: unknown): Operations {
  const root = object(value);
  const memberNotes = rows(root.memberNotes).map(r => {
    const note = Object.fromEntries(["id", "memberId", "memberNo", "name", "company", "industry", "attribute", "industryDetail", "desiredPartners", "oneOnOneUrl", "facebookUrl", "note"].map(key => [key, string(r[key])])) as MemberNote;
    if (!note.name.trim()) throw new Error("氏名を入力してください。");
    for (const link of [note.oneOnOneUrl, note.facebookUrl]) if (link && !safeHttpUrl(link)) throw new Error("URLはhttpまたはhttpsで入力してください。");
    return note;
  });
  const training = rows(root.training).map(r => {
    const courses = object(r.courses);
    const result = Object.fromEntries(COURSES.map(course => {
      const c = object(courses[course]); const status = string(c.status) as TrainingStatus, date = string(c.date);
      if (!TRAINING_STATUSES.includes(status) || (date && !validDate(date))) throw new Error("受講状況・受講日を確認してください。");
      return [course, { status, date }];
    })) as Training["courses"];
    return { id: string(r.id), memberId: string(r.memberId), memberNo: string(r.memberNo), name: string(r.name), sourceAsOf: string(r.sourceAsOf), note: string(r.note), courses: result };
  });
  const seminars = rows(root.seminars).map(r => {
    const month = string(r.month), status = string(r.status) as Seminar["status"];
    if ((month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || !["予定", "終了", "要確認"].includes(status) || !Array.isArray(r.memberIds) || r.memberIds.length > 30) throw new Error("担当月・担当者・状態を確認してください。");
    return { id: string(r.id), month, memberIds: r.memberIds.map(id => string(id, 200)), presenterNames: string(r.presenterNames), status, title: string(r.title), note: string(r.note) };
  });
  for (const list of [memberNotes, training]) {
    const ids = list.map(r => r.memberId).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new Error("同じ会員への紐付けが重複しています。");
  }
  return { memberNotes, training, seminars, sourceNote: string(root.sourceNote, 12000) };
}
