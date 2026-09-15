import type { Member } from "@/types/domain";
import { fetchSharedState, updateSharedState } from "@/lib/data/shared-state";

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
  const shared = await fetchSharedState<SharedMembers>("members") ?? emptySharedMembers();
  cacheSharedMembers(shared);
  return mergeMembers(initialMembers, shared);
}

export async function saveMemberAddition(initialMembers: Member[], member: Member): Promise<Member[]> {
  return saveMemberAdditions(initialMembers, [member]);
}

export async function saveMemberAdditions(initialMembers: Member[], members: Member[]): Promise<Member[]> {
  const next = await updateSharedState<SharedMembers>("members", (shared) => {
    const current = shared ?? emptySharedMembers();
    const usedNumbers = new Set(mergeMembers(initialMembers, current).map((item) => item.memberNo.trim()));
    const additions = members.map((member) => {
      const cleaned = { ...member, memberNo: member.memberNo.trim(), name: member.name.trim() };
      if (!cleaned.memberNo || !cleaned.name) throw new Error("会員番号と氏名を入力してください。");
      if (usedNumbers.has(cleaned.memberNo)) throw new Error(`会員No.${cleaned.memberNo}は既に使用されています。`);
      usedNumbers.add(cleaned.memberNo);
      return cleaned;
    });
    return { ...current, additions: [...current.additions, ...additions] };
  });
  cacheSharedMembers(next);
  return mergeMembers(initialMembers, next);
}

export async function saveMemberOverride(memberId: string, values: Partial<MemberEditableFields>) {
  const next = await updateSharedState<SharedMembers>("members", (shared) => {
    const current = shared ?? emptySharedMembers();
    if (current.deletions.includes(memberId)) throw new Error("この会員は削除されています。会員一覧を再読み込みしてください。");
    return { ...current, overrides: { ...current.overrides, [memberId]: { ...(current.overrides[memberId] ?? {}), ...values } } };
  });
  cacheSharedMembers(next);
}

export async function deleteSharedMember(memberId: string) {
  const next = await updateSharedState<SharedMembers>("members", (shared) => {
    const current = shared ?? emptySharedMembers();
    const overrides = { ...current.overrides };
    delete overrides[memberId];
    return {
      additions: current.additions.filter((member) => member.id !== memberId),
      overrides,
      deletions: [...new Set([...current.deletions, memberId])]
    };
  });
  cacheSharedMembers(next);
}

function emptySharedMembers(): SharedMembers {
  return { additions: [], overrides: {}, deletions: [] };
}

function mergeMembers(initialMembers: Member[], state: SharedMembers) {
  const deleted = new Set(state.deletions);
  return [...initialMembers, ...state.additions]
    .filter((member) => !deleted.has(member.id))
    .map((member) => ({ ...member, ...(state.overrides[member.id] ?? {}) }));
}

function cacheSharedMembers(state: SharedMembers) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMBER_ADDITIONS_KEY, JSON.stringify(state.additions));
    window.localStorage.setItem(MEMBER_OVERRIDES_KEY, JSON.stringify(state.overrides));
    window.localStorage.setItem(MEMBER_DELETIONS_KEY, JSON.stringify(state.deletions));
  } catch {
    // The server is authoritative even when browser storage is full or disabled.
  }
  window.dispatchEvent(new Event("nm-members-updated"));
}
