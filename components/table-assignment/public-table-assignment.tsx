"use client";

import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLocalUpdatedAt } from "@/lib/data/participant-storage";
import type { PublicMeetingTableResponse } from "@/lib/table-assignment/public-snapshot";

export function PublicTableAssignment({ meetingId }: { meetingId: string }) {
  const [data, setData] = useState<PublicMeetingTableResponse | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    setLoaded(false);
    setError("");
    setData(null);
    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/public-table-assignment`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "この定例会のテーブル割りは閲覧できません。トップページから対象の定例会を選び直してください。" : "最新のテーブル割りを取得できませんでした。通信状態を確認して、もう一度読み込んでください。");
        const value = await response.json() as PublicMeetingTableResponse;
        if (active) { setData(value); setError(""); }
      } catch (cause) {
        if (active) { setData(null); setError(cause instanceof Error ? cause.message : "テーブル割りを取得できませんでした。"); }
      } finally {
        inFlight = false;
        if (active) setLoaded(true);
      }
    }
    const refreshVisible = () => { if (document.visibilityState !== "hidden") void refresh(); };
    void refresh();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const timer = window.setInterval(refreshVisible, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.clearInterval(timer);
    };
  }, [meetingId, reloadKey]);

  return (
    <div className="mt-8 space-y-6">
      <button type="button" disabled={!loaded} onClick={() => setReloadKey((value) => value + 1)} className="focus-ring rounded border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-deep disabled:opacity-50">最新のテーブル割りを読み込む</button>
      {!loaded && <p role="status" className="rounded bg-snow p-5">テーブル割りを読み込んでいます…</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-5 text-red-700">{error}</p>}
      {loaded && !error && data && <>
        <div className="rounded border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-black text-deep">{data.meeting.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{data.meeting.date} {data.meeting.startTime}〜{data.meeting.endTime}</p>
          {data.meeting.venueName && <p className="mt-1 text-sm text-slate-600">{data.meeting.venueName}</p>}
          {data.publication && <p className="mt-2 text-sm text-slate-600">公開日時 {formatLocalUpdatedAt(data.publication.publishedAt)} ／ 敬称略</p>}
        </div>
        {data.publication ? <div className="grid gap-4 lg:grid-cols-2">
          {data.publication.tables.map((table, tableIndex) => <article key={`${tableIndex}-${table.tableName}`} className="min-w-0 rounded border border-slate-200 bg-snow p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="break-words text-lg font-black text-deep">{table.tableName}</h3>
              <span className="shrink-0 rounded bg-white px-3 py-1 text-xs font-bold text-slate-600">{table.seats.length}名</span>
            </div>
            <div className="grid gap-2">
              {table.seats.map((seat, index) => <div key={index} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded bg-white p-3">
                <div className="min-w-0 break-words">
                  <p className="font-bold text-deep">{seat.name}</p>
                  <p className="text-xs text-slate-600">{seat.description}</p>
                </div>
                {seat.isLeader && <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-bold text-forest"><Crown size={14} aria-hidden />リーダー</span>}
              </div>)}
              {table.seats.length === 0 && <p className="text-sm text-slate-500">現在、配置されている方はいません。</p>}
            </div>
          </article>)}
        </div> : <p className="rounded border border-slate-200 bg-snow p-5 font-bold text-slate-600">まだテーブル割りは公開されていません。公開後にこちらで確認できます。</p>}
      </>}
    </div>
  );
}
