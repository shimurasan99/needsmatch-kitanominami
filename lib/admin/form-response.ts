import { validDate } from "@/lib/admin/operations";

export const FORM_SHEET_ID = "1-9ZoAycUL2PNpmbvJ9lv3GoQzz3OAFgFTXzQQsjtu0s";
export const FORM_TAB_ID = 388947325;
export type FormResponse = { source?: "hp"; kana?: string; socialAttendance?: string; sourceId: string; sourceRow: number; submittedAt: string; meetingDate: string; memberNo: string; name: string; company: string; industry: string; industryDetail: string; desiredPartners: string; branchName: string; referrer: string; oneOnOneUrl: string; facebookUrl: string; email: string; phone: string; note: string; receivedAt: string; applied?: { meetingId: string; memberId: string; guestId: string; at: string }; ignored?: boolean };
export function parseFormResponse(input: unknown): Omit<FormResponse, "sourceId" | "receivedAt"> {
  if (!input || typeof input !== "object") throw new Error("フォームデータが不正です。");
  const r = input as Record<string, unknown>;
  if (r.spreadsheetId !== FORM_SHEET_ID || r.sheetId !== FORM_TAB_ID || !Number.isSafeInteger(r.row) || Number(r.row) < 2 || Number(r.row) > 1_000_000) throw new Error("対象外のフォームです。");
  if (!Array.isArray(r.values) || r.values.length < 24 || r.values.length > 40 || r.values.some(v => v !== null && typeof v !== "string")) throw new Error("フォームの列構成を確認してください。");
  const v = r.values.map(value => String(value ?? "").trim());
  if (v.some(s => s.length > 10000) || !v[0]) throw new Error("回答日時・文字数を確認してください。");
  const date = v[2].match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\D.*)?$/);
  const meetingDate = date ? `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}` : "";
  if (meetingDate && !validDate(meetingDate)) throw new Error("開催日の形式を確認してください。");
  const numbers = [v[4], v[3]].map(s => s.normalize("NFKC").match(/^(?:NM[-－ ]?)?(\d+)$/i)?.[1]).filter(Boolean);
  const name = v[23] || v[7] || (!/\d/.test(v[4]) ? v[4] : "");
  // Keep malformed historical submissions in the inbox, without stopping later rows.
  // Empty names cannot be applied to attendance (checked again in the database).
  return { sourceRow: Number(r.row), submittedAt: v[0], meetingDate, memberNo: numbers[0] ?? "", name, company: v[10], industry: v[11], industryDetail: v[12], desiredPartners: v[13], branchName: v[9] || v[6], referrer: v[22] || v[5], oneOnOneUrl: v[14], facebookUrl: v[15], email: v[1], phone: v[21] || v[20], note: [!name ? "氏名を特定できない回答です。元シートを確認してください。" : "", !meetingDate ? `開催日要確認（元の回答：${v[2] || "未記入"}）` : "", v[16], v[24]].filter(Boolean).join("\n") };
}
