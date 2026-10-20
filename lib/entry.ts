import type { Meeting } from "@/types/domain";
export const japanDate = (now = new Date()) => now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export function entryOpen(meeting: Meeting, now = new Date()) {
  const today = japanDate(now);
  return meeting.status === "確定" && meeting.date >= today
    && (!meeting.applicationDeadline || meeting.applicationDeadline >= today)
    && (meeting.date !== today || new Date(`${today}T${meeting.startTime}:00+09:00`).getTime() > now.getTime());
}
export type EntryInput = {
  meetingId: string; meetingDate: string; name: string; kana: string; email: string; phone: string;
  participantType: "ゲスト" | "他支部" | "北のみなみ";
  branchName: string; memberNo: string; company: string; industry: string; industryDetail: string;
  desiredPartners: string; referrer: string; socialAttendance: "参加" | "不参加" | "未定";
  note: string; consent: true;
};
export function validateEntry(value: unknown): EntryInput {
  if (!value || typeof value !== "object") throw new Error("入力内容を確認してください。");
  const r = value as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    const s = typeof r[key] === "string" ? (r[key] as string).trim() : "";
    if (s.length > max || (required && !s)) throw new Error(`${({ name: "氏名", kana: "フリガナ", email: "メール", phone: "電話", company: "会社名／屋号", industry: "業種", meetingId: "開催日" } as Record<string,string>)[key] || key}の入力を確認してください。`);
    return s;
  };
  const participantType = text("participantType", 20) as EntryInput["participantType"];
  const socialAttendance = text("socialAttendance", 10) as EntryInput["socialAttendance"];
  const email = text("email", 254, true).toLowerCase(), phone = text("phone", 40, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("メールアドレスを確認してください。");
  if (!/^[+\d()\s-]{7,40}$/.test(phone.normalize("NFKC"))) throw new Error("電話番号を確認してください。");
  if (!["ゲスト", "他支部", "北のみなみ"].includes(participantType) || !["参加", "不参加", "未定"].includes(socialAttendance)) throw new Error("参加区分・懇親会の希望を選択してください。");
  if (r.consent !== true) throw new Error("個人情報の取り扱いを確認して同意してください。");
  const branchName = participantType === "他支部" ? text("branchName", 100, true) : participantType;
  return { meetingId: text("meetingId", 200, true), meetingDate: text("meetingDate", 10, true), name: text("name", 100, true), kana: text("kana", 100, true), email, phone,
    participantType, branchName, memberNo: text("memberNo", 30), company: text("company", 200, true), industry: text("industry", 200, true),
    industryDetail: text("industryDetail", 2000), desiredPartners: text("desiredPartners", 2000), referrer: text("referrer", 100, participantType === "ゲスト"), socialAttendance, note: text("note", 2000), consent: true };
}
