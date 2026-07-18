"use client";

import Link from "next/link";
import { Plus, Save, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { MeetingSettingsPanel } from "@/components/admin/meeting-settings-panel";
import { PastDataManager } from "@/components/admin/past-data-manager";
import { fetchMeetings, saveMeetingRecord } from "@/lib/data/meeting-storage";
import type { AssignmentTable, Meeting, Member, Participant } from "@/types/domain";

export function MeetingsManagement({
  meetings,
  members,
  participants,
  pastAssignments,
  assignmentsByMeetingId
}: {
  meetings: Meeting[];
  members: Member[];
  participants: Participant[];
  pastAssignments: AssignmentTable[];
  assignmentsByMeetingId?: Record<string, AssignmentTable[]>;
}) {
  const [tab, setTab] = useState<"list" | "past">("list");
  const [managedMeetings, setManagedMeetings] = useState(meetings);
  const [isCreating, setIsCreating] = useState(false);
  const currentMeetings = managedMeetings.filter((meeting) => meeting.status !== "終了");
  const pastMeetings = managedMeetings.filter((meeting) => meeting.status === "終了");

  useEffect(() => {
    void fetchMeetings(meetings).then(setManagedMeetings);
  }, [meetings]);

  function replaceMeeting(saved: Meeting) {
    setManagedMeetings((current) => [...current.filter((meeting) => meeting.id !== saved.id), saved].sort((a, b) => a.date.localeCompare(b.date)));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("list")} className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "list" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>月例会一覧</button>
        <button type="button" onClick={() => setTab("past")} className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "past" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>過去データ管理</button>
        <button type="button" onClick={() => setIsCreating(true)} className="focus-ring inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-bold text-white"><Plus size={16} />月例会の新規作成</button>
      </div>

      {isCreating && <NewMeetingForm onCancel={() => setIsCreating(false)} onSaved={(meeting) => { replaceMeeting(meeting); setIsCreating(false); setTab("list"); }} />}

      {tab === "past" ? (
        <PastDataManager meetings={pastMeetings} members={members} assignments={pastAssignments} assignmentsByMeetingId={assignmentsByMeetingId} />
      ) : (
        <div className="grid gap-3">
          {currentMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} members={members} participants={participants.filter((participant) => participant.meetingId === meeting.id)} onSaved={replaceMeeting} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, members, participants, onSaved }: { meeting: Meeting; members: Member[]; participants: Participant[]; onSaved: (meeting: Meeting) => void }) {
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
      <MeetingSettingsPanel meeting={meeting} members={members} participants={participants} onSaved={onSaved} />
    </article>
  );
}

function NewMeetingForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (meeting: Meeting) => void }) {
  const [meeting, setMeeting] = useState<Meeting>({
    id: "",
    title: "",
    date: "",
    startTime: "16:00",
    endTime: "18:00",
    venueName: "会場調整中",
    venueAddress: "",
    note: "",
    applicationDeadline: "",
    status: "確定"
  });
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof Meeting>(field: K, value: Meeting[K]) {
    setMeeting((current) => ({ ...current, [field]: value }));
  }

  function updateDate(date: string) {
    const deadline = new Date(`${date}T00:00:00`);
    deadline.setDate(deadline.getDate() - 3);
    const [year, month] = date.split("-");
    setMeeting((current) => ({
      ...current,
      date,
      title: current.title || (year && month ? `${year}年${Number(month)}月 北のみなみ月例会` : ""),
      applicationDeadline: Number.isNaN(deadline.getTime()) ? "" : deadline.toISOString().slice(0, 10)
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      const saved = await saveMeetingRecord(meeting, true);
      onSaved(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "月例会を保存できませんでした。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 grid gap-4 rounded border border-blue-200 bg-blue-50 p-5 md:grid-cols-2">
      <div className="flex items-center justify-between md:col-span-2">
        <h2 className="text-xl font-black text-deep">月例会の新規作成</h2>
        <button type="button" onClick={onCancel} aria-label="閉じる" className="focus-ring rounded p-2 text-slate-500 hover:bg-white"><X size={20} /></button>
      </div>
      {message && <p className="rounded bg-red-50 p-3 text-sm font-bold text-accent md:col-span-2">{message}</p>}
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">開催日</span><input required type="date" value={meeting.date} onChange={(event) => updateDate(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label>
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">月例会名</span><input required value={meeting.title} onChange={(event) => update("title", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="grid gap-2"><span className="text-sm font-bold text-slate-600">開始</span><input required type="time" value={meeting.startTime} onChange={(event) => update("startTime", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label><label className="grid gap-2"><span className="text-sm font-bold text-slate-600">終了</span><input required type="time" value={meeting.endTime} onChange={(event) => update("endTime", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label></div>
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">回答期限</span><input required type="date" value={meeting.applicationDeadline} onChange={(event) => update("applicationDeadline", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label>
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">会場</span><input required value={meeting.venueName} onChange={(event) => update("venueName", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label>
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">会場住所</span><input value={meeting.venueAddress} onChange={(event) => update("venueAddress", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" /></label>
      <label className="grid gap-2"><span className="text-sm font-bold text-slate-600">状態</span><select value={meeting.status} onChange={(event) => update("status", event.target.value as Meeting["status"])} className="focus-ring rounded border border-slate-200 px-3 py-3"><option>下書き</option><option>確定</option><option>終了</option></select></label>
      <div className="flex items-end justify-end"><button type="submit" disabled={isSaving} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{isSaving ? "保存中…" : "作成して保存"}</button></div>
    </form>
  );
}
