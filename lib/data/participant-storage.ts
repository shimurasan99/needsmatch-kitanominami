"use client";

import type { Member, Participant, ParticipantStatus } from "@/types/domain";

export type StoredParticipantStatus = Extract<ParticipantStatus, "参加" | "欠席" | "未定"> | "キャンセル";

export type StoredGuestEntry = {
  id: string;
  name: string;
  company: string;
  industry: string;
  type: "新規" | "他支部";
  branchName: string;
};

export type StoredParticipants = {
  statuses?: Record<string, StoredParticipantStatus>;
  guests?: StoredGuestEntry[];
  updatedAt?: string;
  guestsUpdatedAt?: string;
};

export const PARTICIPANT_UPDATED_EVENT = "nm-participants-updated";

export function participantStorageKey(meetingId: string) {
  return `nm_meeting_participants_${meetingId}`;
}

export function readStoredParticipants(meetingId: string): StoredParticipants | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(participantStorageKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredParticipants;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredParticipants(meetingId: string, value: StoredParticipants) {
  try { window.localStorage.setItem(participantStorageKey(meetingId), JSON.stringify(value)); } catch { /* Cache is optional. */ }
  window.dispatchEvent(new CustomEvent(PARTICIPANT_UPDATED_EVENT, { detail: { meetingId } }));
}

export async function fetchStoredParticipants(meetingId: string): Promise<StoredParticipants | null> {
  {
    const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/attendance`, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "再度ログインしてください。" : "参加者情報を読み込めませんでした。再読み込みしてください。");
    const value = await response.json() as StoredParticipants;
    try { window.localStorage.setItem(participantStorageKey(meetingId), JSON.stringify(value)); } catch { /* Cache is optional. */ }
    return value;
  }
}

export async function saveMemberAttendance(meetingId: string, memberId: string, status: StoredParticipantStatus) {
  const current = readStoredParticipants(meetingId) ?? {};
  const fallback = { ...current, statuses: { ...current.statuses, [memberId]: status }, updatedAt: new Date().toISOString() };
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, status })
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "出欠を保存できませんでした。"); }
  const result = await response.json() as { updatedAt?: string };
  writeStoredParticipants(meetingId, { ...fallback, updatedAt: result.updatedAt ?? fallback.updatedAt });
  return result.updatedAt ?? fallback.updatedAt;
}

export async function saveAllParticipants(meetingId: string, value: StoredParticipants) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "参加者情報を保存できませんでした。"); }
  await response.json();
  const saved = await fetchStoredParticipants(meetingId) ?? value;
  writeStoredParticipants(meetingId, saved);
  return saved;
}

export function subscribeStoredParticipants(meetingId: string, listener: () => void) {
  const onUpdate = (event: Event) => {
    const detail = (event as CustomEvent<{ meetingId?: string }>).detail;
    if (!detail?.meetingId || detail.meetingId === meetingId) listener();
  };

  window.addEventListener(PARTICIPANT_UPDATED_EVENT, onUpdate);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(PARTICIPANT_UPDATED_EVENT, onUpdate);
    window.removeEventListener("storage", listener);
  };
}

export function countMeetingAttendees(meetingId: string, members: Member[], initialParticipants: Participant[]) {
  const stored = readStoredParticipants(meetingId);
  return storedParticipantsValueToParticipants(meetingId, members, initialParticipants, stored)
    .filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length;
}

export function storedParticipantsToParticipants(meetingId: string, members: Member[], initialParticipants: Participant[]) {
  const stored = readStoredParticipants(meetingId);
  return storedParticipantsValueToParticipants(meetingId, members, initialParticipants, stored);
}

export function storedParticipantsValueToParticipants(meetingId: string, members: Member[], initialParticipants: Participant[], stored: StoredParticipants | null) {
  if (stored === null) return initialParticipants.filter((participant) => participant.meetingId === meetingId);

  const memberParticipants = members.map<Participant>((member) => {
    const status = stored.statuses?.[member.id];
    return {
      id: `stored-${meetingId}-${member.id}`,
      meetingId,
      memberId: member.id,
      status: status === "キャンセル" ? "欠席" : status === "参加" || status === "欠席" || status === "未定"
        ? status
        : "未定"
    };
  });

  const storedGuests = stored.guests;
  const guestParticipants = (storedGuests ?? []).map<Participant>((guest) => ({
    id: guest.id,
    meetingId,
    guestName: guest.name,
    guestCompany: guest.company || guest.branchName || guest.type,
    status: "ゲスト"
  }));

  return [...memberParticipants, ...guestParticipants];
}

export function formatLocalUpdatedAt(value?: string) {
  if (!value) return "未保存";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未保存";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
