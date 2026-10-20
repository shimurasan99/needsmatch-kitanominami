import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { meetings } from "@/lib/data/mock";
import { meetingFromRow } from "@/lib/data/meeting-record";
import { entryOpen } from "@/lib/entry";
type DB = NonNullable<ReturnType<typeof createSupabaseServerClient>>;
const secret = () => { const value = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY; if (!value) throw new Error("保存先未設定"); return value; };
export const entryHash = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
export function issueEntryToken() {
  const body = `${Date.now()}.${randomUUID()}`;
  return `${body}.${entryHash(`entry-token:${body}`)}`;
}
export function verifyEntryToken(token: unknown) {
  if (typeof token !== "string" || token.length > 200) return false;
  const parts = token.split("."); if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[0-9a-f-]{36}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const age = Date.now() - Number(parts[0]);
  return age >= 1500 && age < 2 * 60 * 60 * 1000 && timingSafeEqual(Buffer.from(parts[2]), Buffer.from(entryHash(`entry-token:${parts[0]}.${parts[1]}`)));
}
export async function openEntryMeetings(db: DB) {
  const { data, error } = await db.from("managed_meetings").select("*");
  if (error) throw new Error("開催日を確認できませんでした。");
  const merged = new Map(meetings.map(m => [m.id, m]));
  for (const row of data ?? []) { const m = meetingFromRow(row); merged.set(m.id, m); }
  return [...merged.values()].filter(m => entryOpen(m)).sort((a, b) => a.date.localeCompare(b.date));
}
// Durable CAS rate limit: shared by all server instances, never stores raw IP addresses.
export async function allowEntry(db: DB, identity: string) {
  const key = `admin-entry-rate:${entryHash(identity)}`;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.from("shared_site_state").select("payload,updated_at").eq("state_key", key).maybeSingle();
    if (error) throw error;
    const now = Date.now(), fresh = data?.payload?.until > now;
    const count = fresh ? Number(data!.payload.count) : 0;
    if (count >= 10) return false;
    const row = { state_key: key, payload: { count: count + 1, until: fresh ? data!.payload.until : now + 3600000 }, updated_at: new Date(Math.max(now, Date.parse(data?.updated_at || "") + 1 || now)).toISOString() };
    const result = data
      ? await db.from("shared_site_state").update(row).eq("state_key", key).eq("updated_at", data.updated_at).select("updated_at").maybeSingle()
      : await db.from("shared_site_state").insert(row).select("updated_at").maybeSingle();
    if (!result.error && result.data) return true;
    if (result.error && result.error.code !== "23505") throw result.error;
  }
  return false;
}
