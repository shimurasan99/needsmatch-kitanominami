import type { Member } from "@/types/domain";
import { fetchSharedState, saveSharedState } from "@/lib/data/shared-state";

export const MEMBER_OVERRIDES_KEY = "nm_member_overrides";
export const MEMBER_ADDITIONS_KEY = "nm_member_additions";
export const MEMBER_DELETIONS_KEY = "nm_member_deletions";

export type MemberEditableFields = Pick<Member, "profileImageUrl" | "position" | "isTableLeader" | "industry" | "majorIndustry" | "facebookUrl" | "instagramUrl" | "websiteUrl">;

export type MemberOverrides = Record<string, Partial<MemberEditableFields>>;
type SharedMembers = { additions: Member[]; overrides: MemberOverrides; deletions: string[] };

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

export async function fetchManagedMembers(initialMembers: Member[]): Promise<Member[]> {
  const shared = await fetchSharedState<SharedMembers>("members");
  if (!shared) return applyMemberOverrides(initialMembers, readMemberOverrides());
  cacheSharedMembers(shared);
  return mergeMembers(initialMembers, shared);
}

export async function saveMemberAddition(initialMembers: Member[], member: Member): Promise<Member[]> {
  const current = await currentSharedMembers();
  if ([...initialMembers, ...current.additions].some((item) => item.memberNo.trim() === member.memberNo.trim())) {
    throw new Error(`会員No.${member.memberNo}は既に使用されています。`);
  }
  const next = { ...current, additions: [...current.additions, member] };
  await saveSharedState("members", next);
  cacheSharedMembers(next);
  return mergeMembers(initialMembers, next);
}

export async function saveMemberOverride(memberId: string, values: Partial<MemberEditableFields>) {
  const current = await currentSharedMembers();
  const next = { ...current, overrides: { ...current.overrides, [memberId]: { ...(current.overrides[memberId] ?? {}), ...values } } };
  await saveSharedState("members", next);
  cacheSharedMembers(next);
}

export async function deleteSharedMember(memberId: string) {
  const current = await currentSharedMembers();
  const overrides = { ...current.overrides };
  delete overrides[memberId];
  const next: SharedMembers = {
    additions: current.additions.filter((member) => member.id !== memberId),
    overrides,
    deletions: [...new Set([...current.deletions, memberId])]
  };
  await saveSharedState("members", next);
  cacheSharedMembers(next);
}

async function currentSharedMembers(): Promise<SharedMembers> {
  const shared = await fetchSharedState<SharedMembers>("members");
  return shared ?? { additions: readMemberAdditions(), overrides: readMemberOverrides(), deletions: readDeletedMemberIds() };
}

function mergeMembers(initialMembers: Member[], state: SharedMembers) {
  const deleted = new Set(state.deletions);
  return [...initialMembers, ...state.additions]
    .filter((member) => !deleted.has(member.id))
    .map((member) => ({ ...member, ...(state.overrides[member.id] ?? {}) }));
}

function cacheSharedMembers(state: SharedMembers) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEMBER_ADDITIONS_KEY, JSON.stringify(state.additions));
  window.localStorage.setItem(MEMBER_OVERRIDES_KEY, JSON.stringify(state.overrides));
  window.localStorage.setItem(MEMBER_DELETIONS_KEY, JSON.stringify(state.deletions));
  window.dispatchEvent(new Event("nm-members-updated"));
}
