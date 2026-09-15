"use client";

import { CalendarDays, Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatLocalUpdatedAt } from "@/lib/data/participant-storage";
import { fetchPublishedTableAssignments, subscribePublishedTableAssignments, type PublishedTableAssignment } from "@/lib/data/table-assignment-publication";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import type { AssignmentTable, Meeting } from "@/types/domain";

function meetingMonthLabel(meeting: Meeting) {
  const [year, month] = meeting.date.split("-");
  return `${year}年${Number(month)}月`;
}

export function PublishedTableAssignmentSelector({ meetings }: { meetings: Meeting[] }) {
  const [managedMeetings, setManagedMeetings] = useState(meetings);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [publishedAssignments, setPublishedAssignments] = useState<Record<string, PublishedTableAssignment>>({});
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const visibleMeetings = useMemo(() => {
    const upcoming = (meeting: Meeting) => meeting.status !== "終了" && meeting.date >= today;
    return managedMeetings.filter((meeting) => meeting.status !== "下書き" && (upcoming(meeting) || Boolean(publishedAssignments[meeting.id])))
      .sort((a, b) => {
        if (upcoming(a) !== upcoming(b)) return upcoming(a) ? -1 : 1;
        return upcoming(a) ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      });
  }, [managedMeetings, publishedAssignments, today]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void Promise.all([fetchPublishedTableAssignments(), fetchMeetings(meetings)]).then(([assignments, nextMeetings]) => {
        if (!active) return;
        setPublishedAssignments(assignments);
        setManagedMeetings(nextMeetings);
        setLoaded(true);
        setError("");
      }).catch(() => { if (active) setError("最新のテーブル割りを取得できませんでした。通信状態を確認してください。"); });
    };
    refresh();
    const unsubscribe = subscribePublishedTableAssignments(refresh);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => { active = false; unsubscribe(); window.removeEventListener("focus", refresh); window.clearInterval(interval); };
  }, [meetings]);

  const selectedMeeting = visibleMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? visibleMeetings[0];
  const selectedAssignment = selectedMeeting ? publishedAssignments[selectedMeeting.id] : null;

  if (!loaded || visibleMeetings.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-soft">
        {error ? <p role="alert" className="text-red-700">{error}</p> : !loaded ? <p role="status">テーブル割りを読み込んでいます…</p> : "現在予定されている定例会と、公開済みの過去のテーブル割りはありません。"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleMeetings.map((meeting) => {
          const isSelected = meeting.id === selectedMeeting?.id;
          const isPublished = Boolean(publishedAssignments[meeting.id]);
          return (
            <button
              key={meeting.id}
              type="button"
              onClick={() => setSelectedMeetingId(meeting.id)}
              className={`focus-ring rounded border p-4 text-left shadow-soft transition ${
                isSelected ? "border-forest bg-blue-50" : "border-slate-200 bg-white hover:bg-snow"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <CalendarDays size={16} />
                {meeting.date}
              </div>
              <p className="mt-2 text-lg font-black text-deep">{meetingMonthLabel(meeting)} 定例会のテーブル割りを見る</p>
              <p className={`mt-2 text-xs font-bold ${isPublished ? "text-forest" : "text-slate-500"}`}>
                {isPublished ? "公開済み" : "未公開"}
              </p>
            </button>
          );
        })}
      </div>

      <section className="rounded border border-slate-200 bg-white p-5 shadow-soft">
        <div>
          <p className="text-sm font-bold text-forest">TABLE ASSIGNMENT</p>
          <h2 className="mt-2 text-2xl font-black text-deep">{selectedMeeting ? `${meetingMonthLabel(selectedMeeting)} 定例会のテーブル割り` : "定例会のテーブル割り"}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">敬称略</p>
          {selectedAssignment && <p className="mt-1 text-sm text-slate-600">公開日時 {formatLocalUpdatedAt(selectedAssignment.publishedAt)}</p>}
        </div>

        {selectedAssignment ? (
          <PublishedTables tables={selectedAssignment.tables} />
        ) : (
          <p className="mt-5 rounded bg-snow p-5 text-sm font-bold text-slate-500">まだテーブル割りは公開されていません</p>
        )}
      </section>
    </div>
  );
}

function PublishedTables({ tables }: { tables: AssignmentTable[] }) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {tables.map((table) => (
        <article key={table.tableName} className="rounded border border-slate-200 bg-snow p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black text-deep">{table.tableName}</h3>
            <span className="rounded bg-white px-3 py-1 text-xs font-bold text-slate-600">{table.seats.length}名</span>
          </div>
          <div className="grid gap-2">
            {table.seats.map((seat, index) => (
              <div key={`${table.tableName}-${seat.member?.id ?? seat.guestName ?? index}`} className="rounded bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-deep">{seat.member?.name ?? seat.guestName}</p>
                    <p className="text-xs text-slate-600">{seat.member?.industry ?? seat.guestCompany ?? "ゲスト"}</p>
                  </div>
                  {seat.isLeader && <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-bold text-forest"><Crown size={14} />リーダー</span>}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
