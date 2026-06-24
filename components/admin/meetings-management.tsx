"use client";

import Link from "next/link";
import { useState } from "react";
import { MeetingSettingsPanel } from "@/components/admin/meeting-settings-panel";
import { PastDataManager } from "@/components/admin/past-data-manager";
import type { AssignmentTable, Meeting, Member, Participant } from "@/types/domain";

export function MeetingsManagement({
  meetings,
  members,
  participants,
  pastAssignments
}: {
  meetings: Meeting[];
  members: Member[];
  participants: Participant[];
  pastAssignments: AssignmentTable[];
}) {
  const [tab, setTab] = useState<"list" | "past">("list");
  const currentMeetings = meetings.filter((meeting) => meeting.status !== "終了");
  const pastMeetings = meetings.filter((meeting) => meeting.status === "終了");

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("list")} className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "list" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>月例会一覧</button>
        <button type="button" onClick={() => setTab("past")} className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "past" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>過去データ管理</button>
        <button type="button" className="focus-ring rounded bg-accent px-4 py-2 text-sm font-bold text-white">月例会の新規作成</button>
      </div>

      {tab === "past" ? (
        <PastDataManager meetings={pastMeetings} members={members} assignments={pastAssignments} />
      ) : (
        <div className="grid gap-3">
          {currentMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} members={members} participants={participants.filter((participant) => participant.meetingId === meeting.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, members, participants }: { meeting: Meeting; members: Member[]; participants: Participant[] }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-forest">{meeting.status}</p>
          <h2 className="mt-1 text-xl font-black text-deep">{meeting.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{meeting.date} {meeting.startTime}-{meeting.endTime} / {meeting.venueName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/meetings/${meeting.id}/participants`} className="focus-ring rounded border border-slate-200 px-3 py-2 text-sm font-bold">参加者管理</Link>
          <Link href={`/admin/meetings/${meeting.id}/table-assignments`} className="focus-ring rounded bg-deep px-3 py-2 text-sm font-bold text-white">テーブル割り</Link>
        </div>
      </div>
      <MeetingSettingsPanel meeting={meeting} members={members} participants={participants} />
    </article>
  );
}
