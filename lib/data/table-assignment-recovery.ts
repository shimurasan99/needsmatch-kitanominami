"use client";

import type { AssignmentTable } from "@/types/domain";

export type TableRecoveryCandidate = { key: string; label: string; tables: AssignmentTable[]; updatedAt: string; seatsPerTable?: number };
export const LEGACY_PUBLICATION_KEY = "nm_published_table_assignments";

export function preserveTableDraft(meetingId: string) {
  const raw = window.localStorage.getItem(`draft-table-assignment-${meetingId}`);
  if (!raw) return;
  try {
    window.localStorage.setItem(`nm_table_assignment_recovery_${encodeURIComponent(meetingId)}::${crypto.randomUUID()}`, raw);
  } catch {
    throw new Error("置き換え前の下書きをこの端末に保管できませんでした。編集中の内容を保存してから再度お試しください。");
  }
}

function readJson(key: string): unknown {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null"); } catch { return null; }
}

function parseCandidate(value: unknown, key: string, label: string, seatsPerTable?: number): TableRecoveryCandidate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { tables?: unknown; updatedAt?: unknown; publishedAt?: unknown };
  const tables = Array.isArray(value) ? value : record.tables;
  if (!Array.isArray(tables) || !tables.length || !tables.every((table) => table && typeof table.tableName === "string" && Array.isArray(table.seats) && table.seats.every((seat: { member?: { id?: unknown; name?: unknown }; guestName?: unknown } | null) => seat && (seat.member ? typeof seat.member.id === "string" && typeof seat.member.name === "string" : typeof seat.guestName === "string")))) return null;
  if (!tables.some((table) => table.seats.length)) return null;
  const date = record.updatedAt ?? record.publishedAt;
  return { key, label, tables: tables as AssignmentTable[], updatedAt: typeof date === "string" ? date : "", seatsPerTable };
}

// Read-only discovery. A browser record is evidence to review, never proof that a meeting used it.
export function readTableRecoveryCandidates(meetingId: string): TableRecoveryCandidate[] {
  if (typeof window === "undefined") return [];
  const keys: [string, string, number?][] = [
    [`nm_current_table_assignment_${meetingId}`, "旧画面の保存済みテーブル割り"],
    [`past-table-assignment-${meetingId}`, "旧・過去データ管理で保存した内容"],
    ...[4, 5, 6, 7, 8].map((size): [string, string, number] => [`draft-table-assignment-${meetingId}-${size}`, `旧編集画面の保存内容（${size}人設定）`, size]),
    ...[4, 5, 6, 7, 8].map((size): [string, string, number] => [`latest-table-assignment-${meetingId}-${size}`, `初期編集画面の保存内容（${size}人設定）`, size]),
    [`draft-table-assignment-${meetingId}`, "この端末の作業途中の下書き（未保存の可能性があります）"]
  ];
  const candidates = keys.flatMap(([key, label, size]) => {
    const candidate = parseCandidate(readJson(key), key, label, size);
    return candidate ? [candidate] : [];
  });
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index) ?? "";
      if (!key.startsWith(`nm_table_assignment_recovery_${encodeURIComponent(meetingId)}::`)) continue;
      const candidate = parseCandidate(readJson(key), key, "置き換える前に保管した下書き");
      if (candidate) candidates.push(candidate);
    }
  } catch { /* Other known legacy keys remain available. */ }
  const published = readJson(LEGACY_PUBLICATION_KEY);
  if (published && typeof published === "object") {
    const candidate = parseCandidate((published as Record<string, unknown>)[meetingId], `${LEGACY_PUBLICATION_KEY}:${meetingId}`, "旧公開画面の端末内記録");
    if (candidate) candidates.push(candidate);
  }
  return candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readTableRecoveryMeetingIds(): string[] {
  if (typeof window === "undefined") return [];
  const ids = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index) ?? "";
      const match = key.match(/^nm_current_table_assignment_(.+)$/) ?? key.match(/^past-table-assignment-(.+)$/) ?? key.match(/^latest-table-assignment-(.+)-[4-8]$/) ?? key.match(/^draft-table-assignment-(.+)-[4-8]$/) ?? key.match(/^draft-table-assignment-(.+)$/);
      if (match) ids.add(match[1]);
      const archived = key.match(/^nm_table_assignment_recovery_(.+)::[^:]+$/);
      if (archived) { try { ids.add(decodeURIComponent(archived[1])); } catch { /* Invalid key. */ } }
    }
    const published = readJson(LEGACY_PUBLICATION_KEY);
    if (published && typeof published === "object" && !Array.isArray(published)) Object.keys(published).forEach((id) => ids.add(id));
  } catch { return []; }
  return [...ids].filter((id) => readTableRecoveryCandidates(id).length > 0);
}
