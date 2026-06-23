import type { Member } from "@/types/domain";

export const MEMBER_OVERRIDES_KEY = "nm_member_overrides";

export type MemberEditableFields = Pick<Member, "profileImageUrl" | "position" | "isTableLeader" | "industry" | "facebookUrl" | "instagramUrl" | "websiteUrl">;

export type MemberOverrides = Record<string, Partial<MemberEditableFields>>;

export function applyMemberOverrides(members: Member[], overrides: MemberOverrides): Member[] {
  return members.map((member) => ({ ...member, ...(overrides[member.id] ?? {}) }));
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
