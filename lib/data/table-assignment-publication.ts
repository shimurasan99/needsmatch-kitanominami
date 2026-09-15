"use client";

import type { AssignmentTable } from "@/types/domain";
import { fetchSharedState, updateSharedState } from "@/lib/data/shared-state";
import { compactTableAssignment } from "@/lib/table-assignment/snapshot";

function compactAssignments<T extends { tables: AssignmentTable[] }>(records: Record<string, T> | null): Record<string, T> {
  return Object.fromEntries(Object.entries(records ?? {}).map(([id, record]) => [id, { ...record, tables: compactTableAssignment(record.tables) }]));
}

export type PublishedTableAssignment = {
  meetingId: string;
  tables: AssignmentTable[];
  publishedAt: string;
};

// Keep the old cache untouched: before shared storage, it could be the only saved copy.
const PUBLISHED_TABLE_ASSIGNMENTS_KEY = "nm_published_table_assignments_shared_v2";
export type SavedTableAssignment = { tables: AssignmentTable[]; updatedAt: string; seatsPerTable?: number };
export type SavedAssignments = Record<string, SavedTableAssignment>;

export async function fetchSavedTableAssignments(): Promise<SavedAssignments> {
  return compactAssignments(await fetchSharedState<SavedAssignments>("table-assignment-drafts"));
}

export async function saveTableAssignment(meetingId: string, assignment: SavedTableAssignment, expectedUpdatedAt: string | null) {
  const snapshot = { ...assignment, tables: compactTableAssignment(assignment.tables) };
  await updateSharedState<SavedAssignments>("table-assignment-drafts", (current) => {
    if ((current?.[meetingId]?.updatedAt ?? null) !== expectedUpdatedAt) throw new Error("別の運営担当者がこのテーブル割りを更新しました。編集中の内容はこの端末に保持されています。再読み込みして最新の保存内容を確認してください。");
    return { ...compactAssignments(current), [meetingId]: snapshot };
  });
  return snapshot;
}
export const TABLE_ASSIGNMENT_PUBLISHED_EVENT = "nm-table-assignment-published";

type PublishedAssignments = Record<string, PublishedTableAssignment>;

export function readPublishedTableAssignments(): PublishedAssignments {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY);
    return raw ? compactAssignments(JSON.parse(raw) as PublishedAssignments) : {};
  } catch {
    return {};
  }
}

export function readPublishedTableAssignment(meetingId: string) {
  return readPublishedTableAssignments()[meetingId] ?? null;
}

export async function fetchPublishedTableAssignments() {
  const shared = await fetchSharedState<PublishedAssignments>("table-assignments");
  const next = compactAssignments(shared);
  try { window.localStorage.setItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY, JSON.stringify(next)); } catch { /* Cache is optional. */ }
  return next;
}

export async function publishTableAssignment(meetingId: string, expectedSavedRevision: string, expectedPublishedRevision: string | null) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/table-assignment-publication`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedSavedRevision, expectedPublishedRevision })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.publication) throw new Error(result.error || "公開できませんでした。再読み込みして公開状況を確認してください。");
  const next = result.publication as PublishedTableAssignment;
  const all = { ...readPublishedTableAssignments(), [meetingId]: next };
  try { window.localStorage.setItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY, JSON.stringify(all)); } catch { /* Already saved on server. */ }
  window.dispatchEvent(new CustomEvent(TABLE_ASSIGNMENT_PUBLISHED_EVENT, { detail: { meetingId } }));
  return next;
}

export function subscribePublishedTableAssignments(listener: () => void) {
  window.addEventListener(TABLE_ASSIGNMENT_PUBLISHED_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(TABLE_ASSIGNMENT_PUBLISHED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
