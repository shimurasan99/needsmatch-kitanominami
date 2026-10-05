import { members } from "@/lib/data/mock";
import type { Member } from "@/types/domain";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export async function readAdminMembers(db: NonNullable<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await db.from("shared_site_state").select("payload").eq("state_key", "members").maybeSingle();
  if (error) throw new Error("会員情報を確認できませんでした。");
  const state = data?.payload ?? { additions: [], overrides: {}, deletions: [] };
  return [...members, ...state.additions as Member[]].filter(m => !state.deletions.includes(m.id)).map(m => ({ ...m, ...state.overrides[m.id] })) as Member[];
}
