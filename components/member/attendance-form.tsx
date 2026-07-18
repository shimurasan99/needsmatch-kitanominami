"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchStoredParticipants, saveMemberAttendance } from "@/lib/data/participant-storage";
import { sortMembersForDirectory } from "@/lib/data/member-sort";
import type { Meeting, Member } from "@/types/domain";

type AttendanceStatus = "参加" | "欠席" | "未定";
const statuses: AttendanceStatus[] = ["参加", "欠席", "未定"];

export function AttendanceForm({ meeting, members }: { meeting: Meeting; members: Member[] }) {
  const sortedMembers = useMemo(() => sortMembersForDirectory(members), [members]);
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("参加");
  const [knownStatuses, setKnownStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void fetchStoredParticipants(meeting.id).then((saved) => {
      setKnownStatuses((saved?.statuses ?? {}) as Record<string, AttendanceStatus>);
    });
  }, [meeting.id]);

  function selectMember(value: string) {
    setMemberId(value);
    const savedStatus = knownStatuses[value];
    if (savedStatus && statuses.includes(savedStatus)) setStatus(savedStatus);
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId) return;
    setIsSaving(true);
    setMessage("");
    try {
      await saveMemberAttendance(meeting.id, memberId, status);
      setKnownStatuses((current) => ({ ...current, [memberId]: status }));
      setMessage("出欠を保存しました。回答は何度でも変更できます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "出欠を保存できませんでした。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 rounded border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
      <label className="grid gap-2">
        <span className="font-bold text-deep">お名前</span>
        <select value={memberId} onChange={(event) => selectMember(event.target.value)} required className="focus-ring rounded border border-slate-300 bg-white px-4 py-3">
          <option value="">自分の名前を選択してください</option>
          {sortedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}（会員No.{member.memberNo}）</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="font-bold text-deep">出欠</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {statuses.map((option) => (
            <label key={option} className={`focus-within:ring-2 focus-within:ring-forest flex cursor-pointer items-center justify-center rounded border px-4 py-4 font-bold ${status === option ? "border-forest bg-blue-50 text-forest" : "border-slate-200 bg-white text-slate-600"}`}>
              <input type="radio" name="status" value={option} checked={status === option} onChange={() => { setStatus(option); setMessage(""); }} className="sr-only" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={!memberId || isSaving} className="focus-ring rounded bg-accent px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
        {isSaving ? "保存中…" : "この内容で保存"}
      </button>
      {message && <p role="status" className="flex items-center gap-2 rounded bg-blue-50 p-3 text-sm font-bold text-forest"><CheckCircle2 size={18} />{message}</p>}
    </form>
  );
}
