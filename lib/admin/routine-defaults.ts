import type { Member } from "@/types/domain";
import { normalizeName } from "@/lib/admin/operations";
import type { JoiningRecord, RoutineRecord } from "./routine-record";

// Source: 運営ドキュメント「毎月のルーティン」202609、2026-10-20確認。
// Historical completion dates and month-specific links are intentionally not copied.
const template = [
  ["主催・事務局レポートの提出、名簿のリセット", "中川（裕）", "月例会の前月"],
  ["スライド作成", "渡辺・中川（裕）", "月例会の前月"],
  ["月例会スレッド作成", "渡辺・中川（裕）", "月例会の前月"],
  ["10分セミナー依頼", "伊藤", "月例会の前月"],
  ["新規入会者を連絡用スレッドに招待", "", "逐次"],
  ["新規入会者の紹介者欄への追加、開催場所の編集", "渡辺・中川（裕）", "入会者が確定したら"],
  ["新規入会者へ割引案内、ID・写真・1on1、提出依頼", "中川（裕）・渡辺", "入会者が連絡用スレッドに揃ったら"],
  ["研修・他支部参加の呼びかけ", "井野", "入会者が連絡用スレッドに揃ったら"],
  ["ゲスト勧誘依頼", "渡辺", "月例会の1〜2週間前"],
  ["テーブル割り原案", "井野・吉村", "月例会の2週間前"],
  ["スライドの完成（新入会員紹介ページ）", "", "月例会の1週間前"],
  ["スライドの完成（カーネギー）", "渡辺", "月例会の1週間前"],
  ["スライドの完成（セミナー）", "井野・伊藤", "月例会の1週間前"],
  ["オンライン名簿の公開", "渡辺・中川（裕）", "月例会の1〜3日前"],
  ["オンライン名簿の公開時にゲストへ呼びかけ", "渡辺・中川（裕）", "月例会の1〜3日前"],
  ["テーブル割りの確定", "井野・吉村", "月例会当日"],
  ["テーブルスレッドの作成", "亀嶋・中川（麻）", "月例会当日"],
  ["印刷物PDFの完成（名簿、情報交換シート、入会案内）", "浅里・中川（裕）", "月例会当日"]
];
export const defaultRoutine = (): RoutineRecord => ({ tasks: template.map(([title, owner, timing], i) => ({ id: `routine-${i + 1}`, title, owner, timing, dueDate: "", completedDate: "", done: false, note: "" })) });
export function defaultJoining(members: Member[]): JoiningRecord {
  // The 2026-06-02 meeting note explicitly lists April/May new members.
  // Match unique full names only; no inferred day or ordering within a month.
  const groups: Record<string, string[]> = {
    "2026-04": ["平澤 裕", "大西 浩之", "前阪 去枝", "河野 喜美子", "佐藤隼也", "西森 菜月", "八木 悠磨", "中本 怜男"],
    "2026-05": ["佐藤 彰洋", "坂本 彩", "萩原 新", "島田 尚幸", "藤井 善貴"]
  };
  return { members: Object.entries(groups).flatMap(([joinedMonth, names]) => names.flatMap(name => {
    const matches = members.filter(m => normalizeName(m.name) === normalizeName(name));
    return matches.length === 1 ? [{ memberId: matches[0].id, joinedMonth, source: "運営ドキュメント 2026/6/2議事録「4月、5月新入会員確認」" }] : [];
  })) };
}
