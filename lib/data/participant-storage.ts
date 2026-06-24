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
  window.localStorage.setItem(participantStorageKey(meetingId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(PARTICIPANT_UPDATED_EVENT, { detail: { meetingId } }));
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
  if (!stored?.statuses && !stored?.guests) {
    return initialParticipants.filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length;
  }

  const memberCount = members.filter((member) => stored.statuses?.[member.id] === "参加").length;
  return memberCount + (stored.guests?.length ?? 0);
}

export function storedParticipantsToParticipants(meetingId: string, members: Member[], initialParticipants: Participant[]) {
  const stored = readStoredParticipants(meetingId);
  if (!stored?.statuses && !stored?.guests) return initialParticipants;

  const memberParticipants = members.map<Participant>((member) => {
    const status = stored.statuses?.[member.id];
    return {
      id: `stored-${meetingId}-${member.id}`,
      meetingId,
      memberId: member.id,
      status: status === "参加" || status === "欠席" || status === "未定" ? status : "欠席"
    };
  });

  const guestParticipants = (stored.guests ?? []).map<Participant>((guest) => ({
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
