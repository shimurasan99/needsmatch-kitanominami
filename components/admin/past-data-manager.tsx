"use client";

import { useMemo, useState } from "react";
import { EditableTableAssignment } from "@/components/table-assignment/editable-table-assignment";
import type { AssignmentTable, Meeting, Member } from "@/types/domain";

type PastStatus = "参加" | "欠席" | "キャンセル";

const statusClasses: Record<PastStatus, string> = {
  参加: "text-forest bg-blue-50 border-forest/20",
  欠席: "text-accent bg-red-50 border-accent/20",
  キャンセル: "text-slate-600 bg-slate-100 border-slate-200"
};

export function PastDataManager({
  meetings,
  members,
  assignments,
  assignmentsByMeetingId
}: {
  meetings: Meeting[];
  members: Member[];
  assignments: AssignmentTable[];
  assignmentsByMeetingId?: Record<string, AssignmentTable[]>;
}) {
  const [activeMeetingId, setActiveMeetingId] = useState(meetings[0]?.id ?? "");
  const activeMeeting = meetings.find((meeting) => meeting.id === activeMeetingId) ?? meetings[0];
  const activeAssignments = activeMeeting ? (assignmentsByMeetingId?.[activeMeeting.id] ?? assignments) : assignments;
  const [statuses, setStatuses] = useState<Record<string, PastStatus>>(() => Object.fromEntries(members.map((member, index) => [member.id, index < 20 ? "参加" : "欠席"])) as Record<string, PastStatus>);

  const attendeeCount = useMemo(() => members.filter((member) => statuses[member.id] === "参加").length, [members, statuses]);

  if (!activeMeeting) {
    return <p className="rounded border border-slate-200 bg-white p-5 text-sm font-bold text-slate-600">過去の月例会データがまだありません。</p>;
  }

  function updateStatus(memberId: string, status: PastStatus) {
    setStatuses((current) => ({ ...current, [memberId]: status }));
  }

  return (
    <div className="grid gap-5">
      <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-forest">PAST DATA</p>
            <h2 className="mt-1 text-2xl font-black text-deep">過去データ管理</h2>
            <p className="mt-2 text-sm text-slate-600">過去月例会の参加状況とテーブル割を管理できます。</p>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">対象月例会</span>
            <select value={activeMeetingId} onChange={(event) => setActiveMeetingId(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3">
              {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section className="rounded border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 bg-snow px-4 py-3">
          <h3 className="font-black text-deep">参加者の管理</h3>
          <p className="mt-1 text-sm text-slate-600">参加 {attendeeCount}名 / 欠席・キャンセル {members.length - attendeeCount}名</p>
        </div>
        <div className="grid gap-0">
          {members.map((member) => {
            const status = statuses[member.id] ?? "欠席";
            return (
              <div key={member.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_160px] sm:items-center">
                <div>
                  <p className="font-bold text-deep">{member.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{member.company} / {member.industry}</p>
                </div>
                <select value={status} onChange={(event) => updateStatus(member.id, event.target.value as PastStatus)} className={`focus-ring rounded border px-3 py-2 text-sm font-bold ${statusClasses[status]}`}>
                  <option>参加</option>
                  <option>欠席</option>
                  <option>キャンセル</option>
                </select>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-xl font-black text-deep">テーブル割の手動変更</h3>
          <p className="mt-1 text-sm text-slate-600">メンバー横のプルダウンで別テーブルへ移動し、上下ボタンで順序を変更できます。</p>
        </div>
        <EditableTableAssignment
          key={activeMeeting.id}
          initialTables={activeAssignments}
          storageKey={`past-table-assignment-${activeMeeting.id}`}
          helperText={`${activeMeeting.title} の過去テーブル割`}
        />
      </section>
    </div>
  );
}
