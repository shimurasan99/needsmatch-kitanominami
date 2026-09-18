"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchStoredParticipants, saveMemberAttendance } from "@/lib/data/participant-storage";
import { sortMembersForDirectory } from "@/lib/data/member-sort";
import type { Meeting, Member } from "@/types/domain";

type AttendanceStatus = "参加" | "欠席" | "未定";
const statuses: AttendanceStatus[] = ["参加", "欠席", "未定"];

export function AttendanceForm({ meeting, members }: { meeting: Meeting; members: Member[] }) {
  const sortedMembers = useMemo(() => sortMembersForDirectory(members), [members]);
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("未定");
  const [knownStatuses, setKnownStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const reloading = useRef(false);
  const retrieving = useRef(false);
  const reloadLatest = useRef<() => Promise<void>>(async () => {});
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const selection = useRef({ memberId: "", dirty: false, saving: false });
  const readRevision = useRef(0);
  const knownVersions = useRef<Record<string, string | null>>({});
  const latestVersions = useRef<Record<string, string | null>>({});

  useEffect(() => {
    let active = true;
    const refresh = async (discardDraft = false) => {
      if (selection.current.saving || (reloading.current && !discardDraft)) return;
      const request = ++readRevision.current;
      await fetchStoredParticipants(meeting.id).then((saved) => {
        if (!active || request !== readRevision.current || selection.current.saving) return;
        const next = Object.fromEntries(Object.entries(saved?.statuses ?? {}).map(([id, value]) => [id, value === "キャンセル" ? "欠席" : value])) as Record<string, AttendanceStatus>;
        setKnownStatuses(next);
        const versions = { ...saved?.versions };
        const selectedId = selection.current.memberId;
        const remotelyChanged = !!selectedId && !selection.current.dirty && (versions[selectedId] ?? null) !== (latestVersions.current[selectedId] ?? null);
        latestVersions.current = { ...versions };
        if (discardDraft) selection.current.dirty = false;
        if (selection.current.dirty && selection.current.memberId) versions[selection.current.memberId] = knownVersions.current[selection.current.memberId] ?? null;
        knownVersions.current = versions;
        const selected = next[selection.current.memberId];
        if (selection.current.memberId && !selection.current.dirty) setStatus(selected && statuses.includes(selected) ? selected : "未定");
        setLoaded(true);
        if (discardDraft) { setMessageError(false); setMessage("保存済みの最新の回答を読み込みました。"); }
        else if (remotelyChanged) { setMessageError(false); setMessage("別の画面から更新された最新の回答を反映しました。"); }
      }).catch((error) => { if (active && request === readRevision.current) { setMessageError(true); setMessage(error instanceof Error ? error.message : "出欠を読み込めませんでした。入力内容は保持しています。"); } });
    };
    reloadLatest.current = () => refresh(true);
    const automaticRefresh = () => { void refresh(); };
    automaticRefresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", automaticRefresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(automaticRefresh, 30000);
    return () => { active = false; window.removeEventListener("focus", automaticRefresh); document.removeEventListener("visibilitychange", onVisible); window.clearInterval(timer); };
  }, [meeting.id]);

  function reloadSavedAnswer() {
    if (selection.current.saving || reloading.current) return;
    reloading.current = true;
    ++readRevision.current;
    if (selection.current.dirty) { setConfirmReload(true); return; }
    return confirmReloadSavedAnswer();
  }

  async function confirmReloadSavedAnswer() {
    if (!reloading.current || retrieving.current || selection.current.saving) return;
    retrieving.current = true;
    setConfirmReload(false);
    try {
      setIsReloading(true);
      await reloadLatest.current();
    } finally { retrieving.current = false; reloading.current = false; setIsReloading(false); }
  }

  function cancelReload() {
    if (retrieving.current) return;
    reloading.current = false;
    setConfirmReload(false);
  }

  function selectMember(value: string) {
    selection.current.memberId = value;
    selection.current.dirty = false;
    knownVersions.current[value] = latestVersions.current[value] ?? null;
    setMemberId(value);
    const savedStatus = knownStatuses[value];
    setStatus(savedStatus && statuses.includes(savedStatus) ? savedStatus : "未定");
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId || isSaving || selection.current.saving || reloading.current || !loaded) return;
    setIsSaving(true);
    ++readRevision.current;
    selection.current.saving = true;
    setMessage("");
    try {
      const saved = await saveMemberAttendance(meeting.id, memberId, status, knownVersions.current[memberId] ?? null);
      setKnownStatuses(Object.fromEntries(Object.entries(saved.statuses ?? {}).map(([id, value]) => [id, value === "キャンセル" ? "欠席" : value])) as Record<string, AttendanceStatus>);
      knownVersions.current = saved.versions ?? {};
      latestVersions.current = saved.versions ?? {};
      selection.current.dirty = false;
      setMessageError(false);
      setMessage(`${members.find(member => member.id === memberId)?.name ?? "選択した会員"}さんの「${status}」を保存し、反映を確認しました。`);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "出欠を保存できませんでした。");
    } finally {
      setIsSaving(false);
      selection.current.saving = false;
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 rounded border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
      <label className="grid gap-2">
        <span className="font-bold text-deep">お名前</span>
        <select disabled={!loaded || isSaving || isReloading || confirmReload} value={memberId} onChange={(event) => selectMember(event.target.value)} required className="focus-ring rounded border border-slate-300 bg-white px-4 py-3">
          <option value="">自分の名前を選択してください</option>
          {sortedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}（会員No.{member.memberNo}）</option>)}
        </select>
      </label>

      {memberId && <p className="text-sm font-bold text-slate-600">現在保存されている回答：{knownStatuses[memberId] ?? "未回答"}</p>}

      <fieldset disabled={!loaded || isSaving || isReloading || confirmReload}>
        <legend className="font-bold text-deep">出欠</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {statuses.map((option) => (
            <label key={option} className={`focus-within:ring-2 focus-within:ring-forest flex cursor-pointer items-center justify-center rounded border px-4 py-4 font-bold ${status === option ? "border-forest bg-blue-50 text-forest" : "border-slate-200 bg-white text-slate-600"}`}>
              <input type="radio" name="status" value={option} checked={status === option} onChange={() => { selection.current.dirty = true; setStatus(option); setMessage(""); }} className="sr-only" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={!loaded || !memberId || isSaving || isReloading || confirmReload} className="focus-ring rounded bg-accent px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
        {isSaving ? "保存中…" : "この内容で保存"}
      </button>
      <button type="button" disabled={isSaving || isReloading || confirmReload} onClick={reloadSavedAnswer} className="focus-ring rounded border border-slate-300 px-5 py-3 font-bold disabled:opacity-50">{isReloading ? "最新の回答を読み込み中…" : "保存済みの最新の回答を読み込む"}</button>
      {confirmReload && <div role="alertdialog" aria-label="未保存の選択の破棄を確認" className="rounded border border-amber-300 bg-amber-50 p-4">
        <p className="font-bold">未保存の出欠選択を破棄して、保存済みの最新の回答を読み込みますか？</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={cancelReload} className="focus-ring rounded border bg-white px-4 py-3 font-bold">キャンセル</button>
          <button type="button" onClick={confirmReloadSavedAnswer} className="focus-ring rounded bg-forest px-4 py-3 font-bold text-white">未保存の選択を破棄して読み込む</button>
        </div>
      </div>}
      {message && <p role={messageError ? "alert" : "status"} className={`flex items-center gap-2 rounded p-3 text-sm font-bold ${messageError ? "bg-red-50 text-red-700" : "bg-blue-50 text-forest"}`}>{messageError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{message}</p>}
    </form>
  );
}
