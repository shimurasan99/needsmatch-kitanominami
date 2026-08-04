import type { Member } from "@/types/domain";

export const MEMBER_OVERRIDES_KEY = "nm_member_overrides";
export const MEMBER_ADDITIONS_KEY = "nm_member_additions";
export const MEMBER_DELETIONS_KEY = "nm_member_deletions";

export type MemberEditableFields = Pick<Member, "profileImageUrl" | "position" | "isTableLeader" | "industry" | "majorIndustry" | "facebookUrl" | "instagramUrl" | "websiteUrl">;

export type MemberOverrides = Record<string, Partial<MemberEditableFields>>;

export function applyMemberOverrides(members: Member[], overrides: MemberOverrides): Member[] {
  const allMembers = [...members, ...readMemberAdditions()];
  const deletedMemberIds = new Set(readDeletedMemberIds());
  return allMembers
    .filter((member) => !deletedMemberIds.has(member.id))
    .map((member) => ({ ...member, ...(overrides[member.id] ?? {}) }));
}

export function readMemberOverrides(): MemberOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEMBER_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as MemberOverrides) : {};
  } catch {
    return {};
  }
}

export function writeMemberOverride(memberId: string, values: Partial<MemberEditableFields>) {
  const current = readMemberOverrides();
  const next = { ...current, [memberId]: { ...(current[memberId] ?? {}), ...values } };
  window.localStorage.setItem(MEMBER_OVERRIDES_KEY, JSON.stringify(next));
}

export function readMemberAdditions(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEMBER_ADDITIONS_KEY);
    return raw ? (JSON.parse(raw) as Member[]) : [];
  } catch {
    return [];
  }
}

export function writeMemberAdditions(members: Member[]) {
  window.localStorage.setItem(MEMBER_ADDITIONS_KEY, JSON.stringify(members));
}

export function readDeletedMemberIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMBER_DELETIONS_KEY) ?? "[]") as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteMemberRecord(memberId: string) {
  writeMemberAdditions(readMemberAdditions().filter((member) => member.id !== memberId));

  const overrides = readMemberOverrides();
  delete overrides[memberId];
  window.localStorage.setItem(MEMBER_OVERRIDES_KEY, JSON.stringify(overrides));

  const deletedMemberIds = new Set(readDeletedMemberIds());
  deletedMemberIds.add(memberId);
  window.localStorage.setItem(MEMBER_DELETIONS_KEY, JSON.stringify([...deletedMemberIds]));
}
