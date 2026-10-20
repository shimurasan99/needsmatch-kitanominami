import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateEntry } from "@/lib/entry";
import { allowEntry, entryHash, issueEntryToken, openEntryMeetings, verifyEntryToken } from "@/lib/entry-server";
import type { FormResponse } from "@/lib/admin/form-response";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "現在、申込受付を準備中です。運営へご連絡ください。" }, 503);
  try {
    const meetings = (await openEntryMeetings(db)).map(m => ({ id: m.id, title: m.title, date: m.date, startTime: m.startTime, venueName: m.venueName, venueAddress: m.venueAddress, applicationDeadline: m.applicationDeadline }));
    return reply({ meetings, token: issueEntryToken() });
  } catch { return reply({ error: "開催日を取得できませんでした。再読み込みしてください。" }, 503); }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "HPの参加申込ページから送信してください。" }, 403);
  let input, token: string;
  try {
    const raw = await request.text(); if (raw.length > 16000) throw new Error("入力が長すぎます。");
    const body = JSON.parse(raw);
    if (body.website || !verifyEntryToken(body.token)) throw new Error("受付画面の有効期限を確認できません。入力内容を控えてページを開き直してください。");
    token = body.token; input = validateEntry(body);
  } catch (e) { return reply({ error: e instanceof Error ? e.message : "入力を確認してください。" }, 400); }
  const db = createSupabaseServerClient(); if (!db) return reply({ error: "受付を保存できません。運営へご連絡ください。" }, 503);
  try {
    const id = entryHash(`entry-receipt:${token}`), contentHash = entryHash(JSON.stringify(input));
    const { data: previous, error: readError } = await db.from("shared_site_state").select("payload").eq("state_key", `admin-form:${id}`).maybeSingle();
    if (readError) throw readError;
    if (previous) return previous.payload.contentHash === contentHash
      ? reply({ accepted: true, receipt: id.slice(0, 12), duplicate: true })
      : reply({ error: "この送信は受付済みです。内容の変更は運営へご連絡ください。" }, 409);
    const meeting = (await openEntryMeetings(db)).find(m => m.id === input.meetingId);
    if (!meeting || meeting.date !== input.meetingDate) return reply({ error: "この月例会は受付終了、または日程が変更されました。開催日を再確認してください。" }, 400);
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!await allowEntry(db, `ip:${ip}`)) return reply({ error: "送信回数の上限に達しました。時間をおいて再度お試しください。" }, 429);
    const now = new Date().toISOString();
    const payload: FormResponse & { contentHash: string } = { ...input, source: "hp", sourceId: id, sourceRow: 0, submittedAt: now, receivedAt: now, meetingDate: meeting.date, oneOnOneUrl: "", facebookUrl: "", contentHash };
    const { error } = await db.from("shared_site_state").insert({ state_key: `admin-form:${id}`, payload });
    if (error?.code === "23505") {
      const { data: saved, error: retryError } = await db.from("shared_site_state").select("payload").eq("state_key", `admin-form:${id}`).maybeSingle();
      if (!retryError && saved?.payload?.contentHash === contentHash) return reply({ accepted: true, receipt: id.slice(0, 12), duplicate: true });
      return reply({ error: "重複送信を確認しました。受付状況は運営へお問い合わせください。" }, 409);
    }
    if (error) throw error;
    return reply({ accepted: true, receipt: id.slice(0, 12) }, 201);
  } catch { return reply({ error: "保存結果を確認できませんでした。入力は消さずに、もう一度送信してください。同じ送信は重複登録しません。" }, 503); }
}
