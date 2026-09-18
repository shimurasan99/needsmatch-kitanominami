"use client";

import type { Member, Participant, ParticipantStatus } from "@/types/domain";

export type StoredParticipantStatus = Extract<ParticipantStatus, "参加" | "欠席" | "未定"> | "キャンセル";

export type StoredGuestEntry = {
  status?: "参加" | "欠席";
  id: string;
  name: string;
  company: string;
  industry: string;
  type: "新規" | "他支部";
  branchName: string;
};

export type StoredParticipants = {
  statuses?: Record<string, StoredParticipantStatus>;
  versions?: Record<string, string | null>;
  expectedVersions?: Record<string, string | null>;
  guests?: StoredGuestEntry[];
  updatedAt?: string;
  guestsUpdatedAt?: string | null;
};

export const PARTICIPANT_UPDATED_EVENT = "nm-participants-updated";

export function participantStorageKey(meetingId: string) {
  return `nm_meeting_participants_server_v2_${meetingId}`;
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

export async function saveMemberAttendance(meetingId: string, memberId: string, status: StoredParticipantStatus, expectedVersion: string | null) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, status, expectedVersions: { [memberId]: expectedVersion } })
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "出欠を保存できませんでした。"); }
  const committed = await response.json() as StoredParticipants;
  if (committed.statuses?.[memberId] !== status || !committed.versions?.[memberId]) throw new Error("保存結果を確認できませんでした。最新の出欠を確認してください。");
  const saved = await fetchStoredParticipants(meetingId);
  if (!saved || saved.statuses?.[memberId] !== status) {
    throw new Error("保存後の出欠を確認できませんでした。他の画面で更新された可能性があります。最新の内容を読み込んで、もう一度確認してください。");
  }
  writeStoredParticipants(meetingId, saved);
  return saved;
}

export async function saveAllParticipants(meetingId: string, value: StoredParticipants) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "参加者情報を保存できませんでした。"); }
  const committed = await response.json() as StoredParticipants;
  if (!committed.statuses || !committed.versions || Object.entries(value.statuses ?? {}).some(([id, status]) => committed.statuses?.[id] !== status || !committed.versions?.[id])
    || (value.guests !== undefined && !sameGuestList(committed.guests ?? [], value.guests))) throw new Error("保存結果を確認できませんでした。入力内容を保持しています。");
  const saved = await fetchStoredParticipants(meetingId);
  if (!saved || Object.entries(value.statuses ?? {}).some(([id, status]) => saved.statuses?.[id] !== status)
    || (value.guests !== undefined && !sameGuestList(saved.guests ?? [], value.guests))) {
    throw new Error("保存後の参加者情報が送信内容と一致しません。他の画面で更新された可能性があります。入力内容は保持しています。最新の内容を確認してから保存してください。");
  }
  writeStoredParticipants(meetingId, saved);
  return saved;
}

function sameGuestList(actual: StoredGuestEntry[], expected: StoredGuestEntry[]) {
  const normalize = (guest: StoredGuestEntry) => JSON.stringify(Object.entries(guest).sort(([a], [b]) => a.localeCompare(b)));
  return actual.length === expected.length && actual.every((guest, index) => normalize(guest) === normalize(expected[index]));
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
    status: guest.status === "欠席" ? "欠席" : "ゲスト"
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
