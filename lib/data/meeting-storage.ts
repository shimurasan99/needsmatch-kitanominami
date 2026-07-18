"use client";

import type { Meeting } from "@/types/domain";

const STORAGE_KEY = "nm_managed_meetings";

function readLocalMeetings(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Meeting[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeMeetings(initial: Meeting[], stored: Meeting[]) {
  const byId = new Map(initial.map((meeting) => [meeting.id, meeting]));
  stored.forEach((meeting) => byId.set(meeting.id, meeting));
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchMeetings(initial: Meeting[]) {
  try {
    const response = await fetch("/api/meetings", { cache: "no-store" });
    if (!response.ok) return mergeMeetings(initial, readLocalMeetings());
    const remote = await response.json() as Meeting[];
    const merged = mergeMeetings(initial, remote);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return mergeMeetings(initial, readLocalMeetings());
  }
}

export async function saveMeetingRecord(meeting: Meeting, isNew = false) {
  let saved = isNew && !meeting.id
    ? { ...meeting, id: `meeting-${meeting.date}-${Date.now().toString(36)}` }
    : meeting;
  try {
    const response = await fetch(isNew ? "/api/meetings" : `/api/meetings/${encodeURIComponent(meeting.id)}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved)
    });
    if (response.ok) saved = await response.json() as Meeting;
    else if (response.status !== 503) throw new Error("月例会を保存できませんでした。");
  } catch (error) {
    if (error instanceof Error && error.message === "月例会を保存できませんでした。") throw error;
  }

  const merged = mergeMeetings(readLocalMeetings(), [saved]);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return saved;
}
