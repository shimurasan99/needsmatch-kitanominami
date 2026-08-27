"use client";

import type { AssignmentTable } from "@/types/domain";
import { fetchSharedState, saveSharedState } from "@/lib/data/shared-state";

export type PublishedTableAssignment = {
  meetingId: string;
  tables: AssignmentTable[];
  publishedAt: string;
};

const PUBLISHED_TABLE_ASSIGNMENTS_KEY = "nm_published_table_assignments";
export const TABLE_ASSIGNMENT_PUBLISHED_EVENT = "nm-table-assignment-published";

type PublishedAssignments = Record<string, PublishedTableAssignment>;

export function readPublishedTableAssignments(): PublishedAssignments {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY);
    return raw ? (JSON.parse(raw) as PublishedAssignments) : {};
  } catch {
    return {};
  }
}

export function readPublishedTableAssignment(meetingId: string) {
  return readPublishedTableAssignments()[meetingId] ?? null;
}

export async function fetchPublishedTableAssignments() {
  const shared = await fetchSharedState<PublishedAssignments>("table-assignments");
  const next = shared ?? readPublishedTableAssignments();
  window.localStorage.setItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY, JSON.stringify(next));
  return next;
}

export async function publishTableAssignment(meetingId: string, tables: AssignmentTable[]) {
  const current = readPublishedTableAssignments();
  const next: PublishedTableAssignment = {
    meetingId,
    tables,
    publishedAt: new Date().toISOString()
  };

  const all = { ...current, [meetingId]: next };
  await saveSharedState("table-assignments", all);
  window.localStorage.setItem(PUBLISHED_TABLE_ASSIGNMENTS_KEY, JSON.stringify(all));
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
