"use client";

import { CalendarDays, Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatLocalUpdatedAt } from "@/lib/data/participant-storage";
import { readPublishedTableAssignments, subscribePublishedTableAssignments, type PublishedTableAssignment } from "@/lib/data/table-assignment-publication";
import type { AssignmentTable, Meeting } from "@/types/domain";

function meetingMonthLabel(meeting: Meeting) {
  return `${new Date(meeting.date).getMonth() + 1}月`;
}

export function PublishedTableAssignmentSelector({ meetings }: { meetings: Meeting[] }) {
  const upcomingMeetings = useMemo(() => meetings.filter((meeting) => meeting.status !== "終了").sort((a, b) => a.date.localeCompare(b.date)), [meetings]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(upcomingMeetings[0]?.id ?? "");
  const [publishedAssignments, setPublishedAssignments] = useState<Record<string, PublishedTableAssignment>>({});

  useEffect(() => {
    setPublishedAssignments(readPublishedTableAssignments());
    return subscribePublishedTableAssignments(() => setPublishedAssignments(readPublishedTableAssignments()));
  }, []);

  const selectedMeeting = upcomingMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? upcomingMeetings[0];
  const selectedAssignment = selectedMeeting ? publishedAssignments[selectedMeeting.id] : null;

  if (upcomingMeetings.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-soft">
        現在予定されている定例会はありません。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingMeetings.map((meeting) => {
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
