"use client";

import { Crown, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { EditableTableAssignment } from "@/components/table-assignment/editable-table-assignment";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import { fetchStoredParticipants, formatLocalUpdatedAt, storedParticipantsValueToParticipants, subscribeStoredParticipants, type StoredParticipants } from "@/lib/data/participant-storage";
import { fetchPublishedTableAssignments, fetchSavedTableAssignments, publishTableAssignment, saveTableAssignment, type SavedTableAssignment } from "@/lib/data/table-assignment-publication";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import { generateTableAssignment } from "@/lib/table-assignment/generator";
import { compactTableAssignment } from "@/lib/table-assignment/snapshot";
import { reconcileTableMembers } from "@/lib/table-assignment/member-identity";
import { markSeatAbsent } from "@/lib/table-assignment/manual-absence";
import { preserveTableDraft, readTableRecoveryCandidates, type TableRecoveryCandidate } from "@/lib/data/table-assignment-recovery";
import type { AssignmentSeat, AssignmentTable, Meeting, Member, Participant } from "@/types/domain";

function assignmentHistory(meetingId: string, meetings: Meeting[], drafts: Record<string, SavedTableAssignment>, published: Record<string, { tables: AssignmentTable[]; publishedAt: string }>, members: Member[]) {
  const current = meetings.find((meeting) => meeting.id === meetingId);
  const previous = current ? meetings.filter((meeting) => meeting.status !== "下書き" && meeting.date < current.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2) : [];
  const tablesFor = (meeting: Meeting) => {
    const draft = drafts[meeting.id];
    const publication = published[meeting.id];
    return (draft && (!publication || draft.updatedAt >= publication.publishedAt) ? draft.tables : publication?.tables) ?? [];
  };
  const missing = previous.filter((meeting) => !tablesFor(meeting).some((table) => table.seats.length));
  const reconciled = reconcileTableMembers(previous.flatMap(tablesFor), members);
  const missingMessage = !current ? "定例会の日付が見つからず、過去2回の履歴を確認できません。" : missing.length ? `過去の定例会 ${missing.map((meeting) => meeting.date).join("、")} のテーブル割りを共有保存先で確認できないため、その回の重複は確認できません。旧画面で保存した内容が当時の端末に残っている可能性があります。` : "";
  return { tables: reconciled.tables, message: [missingMessage, reconciled.warning].filter(Boolean).join(" ") };
}

type StoredTableAssignment = SavedTableAssignment;

function currentAssignmentStorageKey(meetingId: string) {
  return `nm_current_table_assignment_${meetingId}`;
}

function readCurrentAssignment(meetingId: string): StoredTableAssignment | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(currentAssignmentStorageKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTableAssignment | AssignmentTable[];
    if (Array.isArray(parsed)) return { tables: normalizeTableNames(parsed), updatedAt: "" };
    if (parsed && Array.isArray(parsed.tables)) return { ...parsed, tables: normalizeTableNames(parsed.tables) };
    return null;
  } catch {
    return null;
  }
}

function normalizeTableNames(tables: AssignmentTable[]) {
  return tables.map((table, index) => {
    if (/^[A-Z]+テーブル$/.test(table.tableName)) return table;
    return { ...table, tableName: `${tableLabel(index)}テーブル` };
  });
}

function tableLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function TableAssignmentManager({
  meetingId,
  initialMembers,
  initialParticipants,
  initialMeetings,
  initialSeatsPerTable
}: {
  meetingId: string;
  initialMembers: Member[];
  initialParticipants: Participant[];
  initialMeetings: Meeting[];
  initialSeatsPerTable: number;
}) {
  const initialData = useRef({ initialMembers, initialMeetings, initialSeatsPerTable });
  initialData.current = { initialMembers, initialMeetings, initialSeatsPerTable };
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [participantVersion, setParticipantVersion] = useState(0);
  const [storedParticipants, setStoredParticipants] = useState<StoredParticipants | null>(null);
  const [seatsPerTable, setSeatsPerTable] = useState(initialSeatsPerTable);
  const [draftSeatsPerTable, setDraftSeatsPerTable] = useState(initialSeatsPerTable);
  const [currentAssignment, setCurrentAssignment] = useState<StoredTableAssignment | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | undefined>();
  const [historyMessage, setHistoryMessage] = useState("");
  const [editor, setEditor] = useState<{ tables: AssignmentTable[]; score?: number; warnings?: string[]; revision: number; restoreDraft: boolean; savedAt?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const [recoveryCandidates, setRecoveryCandidates] = useState<TableRecoveryCandidate[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const lifetime = useRef(0);
  const participantRequest = useRef(0);

  useEffect(() => {
    const { initialMembers, initialMeetings, initialSeatsPerTable } = initialData.current;
    let active = true;
    const epoch = ++lifetime.current;
    operation.current = false;
    setBusy(false);
    setPublishing(false);
    setReady(false);
    setError("");
    setRecoveryCandidates(readTableRecoveryCandidates(meetingId));
    setRecoveryMessage("");
    Promise.all([fetchManagedMembers(initialMembers), fetchStoredParticipants(meetingId), fetchSavedTableAssignments(), fetchPublishedTableAssignments(), fetchMeetings(initialMeetings)])
      .then(([nextMembers, participants, drafts, published, meetings]) => {
        if (!active) return;
        setMembers(nextMembers);
        setStoredParticipants(participants);
        const publication = published[meetingId];
        const saved = drafts[meetingId] ?? (publication ? { tables: publication.tables, updatedAt: publication.publishedAt } : null);
        setSavedVersion(drafts[meetingId]?.updatedAt ?? null);
        const local = readCurrentAssignment(meetingId);
        const browserDraft = readTableRecoveryCandidates(meetingId).find((candidate) => candidate.key === `draft-table-assignment-${meetingId}`);
        const initial = browserDraft && (!saved || browserDraft.updatedAt > saved.updatedAt) ? browserDraft : saved ?? local;
        setCurrentAssignment(saved);
        setPublishedAt(publication?.publishedAt);
        const size = initial?.seatsPerTable ?? initialSeatsPerTable;
        setSeatsPerTable(size);
        setDraftSeatsPerTable(size);
        const reconciled = reconcileTableMembers(initial?.tables ?? [], nextMembers);
        setEditor({ tables: reconciled.tables, revision: 0, restoreDraft: false, savedAt: saved?.updatedAt });
        setRecoveryMessage(reconciled.warning);
        setHistoryMessage(assignmentHistory(meetingId, meetings, drafts, published, nextMembers).message);
        setReady(true);
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "テーブル割りの読み込みに失敗しました。"); });
    return () => { active = false; lifetime.current = epoch + 1; };
  }, [meetingId]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (operation.current) return;
      const request = ++participantRequest.current;
      void Promise.all([fetchManagedMembers(initialData.current.initialMembers), fetchStoredParticipants(meetingId)]).then(([nextMembers, value]) => {
        if (!active || request !== participantRequest.current) return;
        setMembers(nextMembers);
        setStoredParticipants(value);
        setParticipantVersion((current) => current + 1);
      }).catch((cause) => { if (active && request === participantRequest.current) setError(cause instanceof Error ? cause.message : "参加者の読み込みに失敗しました。"); });
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const unsubscribe = subscribeStoredParticipants(meetingId, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 30000);
    return () => { active = false; unsubscribe(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); window.clearInterval(timer); };
  }, [meetingId]);

  const generationParticipants = useMemo(() => {
    void participantVersion;
    return storedParticipantsValueToParticipants(meetingId, members, initialParticipants, storedParticipants);
  }, [initialParticipants, meetingId, members, participantVersion, storedParticipants]);

  const attendeesCount = useMemo(() => {
    return generationParticipants.filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length;
  }, [generationParticipants]);

  async function refreshAdditionMembers() {
    if (operation.current) throw new Error("処理中です。完了後に名簿を更新してください。");
    operation.current = true;
    setBusy(true);
    const run = lifetime.current;
    participantRequest.current++;
    try {
      const [nextMembers, attendance] = await Promise.all([
        fetchManagedMembers(initialData.current.initialMembers), fetchStoredParticipants(meetingId)
      ]);
      if (run !== lifetime.current) return;
      setMembers(nextMembers);
      setStoredParticipants(attendance);
      setParticipantVersion((current) => current + 1);
    } finally { if (run === lifetime.current) { operation.current = false; setBusy(false); } }
  }

  async function markAbsent(seat: AssignmentSeat) {
    if (!ready || operation.current) throw new Error("処理中です。完了後にもう一度お試しください。");
    operation.current = true;
    setBusy(true);
    const run = lifetime.current;
    participantRequest.current++;
    try {
      const nextMembers = await fetchManagedMembers(initialData.current.initialMembers);
      if (run !== lifetime.current) throw new Error("画面が切り替わりました。最新の出欠をご確認ください。");
      const result = await markSeatAbsent(meetingId, seat, nextMembers);
      if (run !== lifetime.current) throw new Error("画面が切り替わりました。最新の出欠をご確認ください。");
      setMembers(nextMembers);
      setStoredParticipants(result.participants);
      setParticipantVersion((current) => current + 1);
      return { attendanceUpdated: result.attendanceUpdated };
    } finally { if (run === lifetime.current) { operation.current = false; setBusy(false); } }
  }

  async function generateTables(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || operation.current) return;
    if (!window.confirm("編集中・復元済みの下書きを置き換えて、自動生成しますか？")) return;
    operation.current = true;
    setBusy(true);
    const run = lifetime.current;
    participantRequest.current++;
    setError("");
    try {
    const [nextMembers, attendance, drafts, published, meetings] = await Promise.all([fetchManagedMembers(initialData.current.initialMembers), fetchStoredParticipants(meetingId), fetchSavedTableAssignments(), fetchPublishedTableAssignments(), fetchMeetings(initialData.current.initialMeetings)]);
    if (run !== lifetime.current) return;
    const history = assignmentHistory(meetingId, meetings, drafts, published, nextMembers);
    const participants = storedParticipantsValueToParticipants(meetingId, nextMembers, initialParticipants, attendance);
    if (!participants.some((participant) => participant.status === "参加" || participant.status === "ゲスト")) throw new Error("最新の参加予定者が0名のため生成できません。編集中のテーブル割りは保持しています。");
    const generated = generateTableAssignment(participants, nextMembers, history.tables, 1200, draftSeatsPerTable);
    preserveTableDraft(meetingId);
    setMembers(nextMembers);
    setStoredParticipants(attendance);
    setHistoryMessage(history.message);
    setRecoveryMessage("");
    setSeatsPerTable(draftSeatsPerTable);
    setEditor((previous) => ({ ...generated, revision: (previous?.revision ?? 0) + 1, restoreDraft: false }));
    try { window.localStorage.setItem(`draft-table-assignment-${meetingId}`, JSON.stringify({ tables: compactTableAssignment(generated.tables), updatedAt: new Date().toISOString() })); } catch { /* Save button remains available. */ }
    } catch (cause) { if (run === lifetime.current) setError(cause instanceof Error ? cause.message : "最新情報を読み込めませんでした。編集中のテーブル割りは保持しています。"); }
    finally { if (run === lifetime.current) { operation.current = false; setBusy(false); } }
  }

  async function saveCurrentTables(tables: AssignmentTable[], updatedAt: string) {
    if (operation.current) throw new Error("処理中です。完了後にもう一度保存してください。");
    operation.current = true;
    setBusy(true);
    const run = lifetime.current;
    try {
    const next = { tables, updatedAt, seatsPerTable };
    await saveTableAssignment(meetingId, next, savedVersion);
    if (run !== lifetime.current) return;
    setSavedVersion(updatedAt);
    setCurrentAssignment(next);
    setRecoveryMessage(reconcileTableMembers(tables, members).warning);
    } finally { if (run === lifetime.current) { operation.current = false; setBusy(false); } }
  }

  async function publishCurrentTables() {
    if (!currentAssignment || publishing || operation.current) return;
    if (!savedVersion) { setError("先にテーブル割りを「保存」してから公開してください。"); return; }
    operation.current = true;
    setBusy(true);
    const run = lifetime.current;
    setPublishing(true);
    try {
      const published = await publishTableAssignment(meetingId, savedVersion, publishedAt ?? null);
      if (run === lifetime.current) setPublishedAt(published.publishedAt);
    } catch (cause) {
      if (run === lifetime.current) setError(cause instanceof Error ? cause.message : "テーブル割りをサーバーへ公開できませんでした。");
    } finally { if (run === lifetime.current) { operation.current = false; setBusy(false); setPublishing(false); } }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded bg-red-50 p-4 font-bold text-red-700">{error} <button type="button" onClick={() => window.location.reload()} className="underline">再読み込み</button></p>}
      {!ready && !error && <p role="status">保存済みのテーブル割りと参加者を読み込んでいます…</p>}
      {historyMessage && <p role="status" className="rounded bg-amber-50 p-4 text-amber-900">{historyMessage}</p>}
      {recoveryMessage && <p role="status" className="rounded bg-blue-50 p-4 text-deep">{recoveryMessage}</p>}
      {recoveryCandidates.length > 0 && <section className="rounded border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-black text-deep">この端末に残っている保存記録・下書き</h2>
        <p className="mt-2 text-sm">旧画面の保存は端末内だけの場合がありました。実際に使用した割り当てか内容を確認してください。読み込みだけでは共有・公開しません。</p>
        {recoveryCandidates.map((candidate) => <details key={candidate.key} className="mt-3 rounded border bg-white p-3">
          <summary className="cursor-pointer font-bold">{candidate.label} — {formatLocalUpdatedAt(candidate.updatedAt)} / {candidate.tables.reduce((count, table) => count + table.seats.length, 0)}名</summary>
          <ReadOnlyTables tables={candidate.tables} />
          <button type="button" disabled={!ready || busy} className="focus-ring mt-3 rounded bg-forest px-4 py-2 font-bold text-white disabled:opacity-50" onClick={() => {
            if (operation.current) return;
            if (!window.confirm("この記録を編集欄へ読み込みます。現在編集中の内容がある場合は先に保存してください。読み込みますか？")) return;
            try { preserveTableDraft(meetingId); } catch (cause) { setError(cause instanceof Error ? cause.message : "下書きを保管できませんでした。"); return; }
            const reconciled = reconcileTableMembers(candidate.tables, members);
            setEditor((previous) => ({ tables: reconciled.tables, revision: (previous?.revision ?? 0) + 1, restoreDraft: false }));
            if (candidate.seatsPerTable) { setSeatsPerTable(candidate.seatsPerTable); setDraftSeatsPerTable(candidate.seatsPerTable); }
            setRecoveryMessage(`端末内の記録を編集欄に読み込みました。内容を確認後に「保存」で共有保存します。会員向け公開は別の操作です。元の旧保存記録は保持しています。 ${reconciled.warning}`);
          }}>この内容を編集欄へ読み込む</button>
        </details>)}
      </section>}
      <section className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">現在のテーブル割り</p>
            <h2 className="mt-1 text-2xl font-black text-deep">保存済みテーブル割り</h2>
            <p className="mt-1 text-sm text-slate-600">最終更新 {formatLocalUpdatedAt(currentAssignment?.updatedAt)}</p>
            {publishedAt && <p className="mt-1 text-sm font-bold text-forest">公開済み: {formatLocalUpdatedAt(publishedAt)}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded bg-snow px-3 py-2 text-sm font-bold text-slate-600">参加設定: {attendeesCount}名</div>
            <button
              type="button"
              onClick={publishCurrentTables}
              disabled={!currentAssignment?.tables.length || busy || !ready}
              className="focus-ring inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {publishing ? "公開中…" : "保存済みの内容を公開する"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm font-bold text-slate-600">公開すると、トップページの「テーブル割を見る」から、ログインしていない方も氏名・業種などの配置情報を閲覧できます。未公開の編集内容は表示されません。</p>

        {currentAssignment ? (
          <ReadOnlyTables tables={currentAssignment.tables} />
        ) : (
          <p className="mt-4 rounded bg-snow p-4 text-sm font-bold text-slate-500">現在テーブル割は作成されていません</p>
        )}
      </section>

      <form onSubmit={generateTables} className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 shadow-soft">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-600">1テーブルあたりの人数</span>
          <select
            value={draftSeatsPerTable}
            disabled={busy}
            onChange={(event) => setDraftSeatsPerTable(Number(event.target.value))}
            className="focus-ring rounded border border-slate-200 px-3 py-2"
          >
            <option value="4">4人</option>
            <option value="5">5人</option>
            <option value="6">6人</option>
            <option value="7">7人</option>
            <option value="8">8人</option>
          </select>
        </label>
        <button type="submit" disabled={!ready || busy} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-deep disabled:opacity-50">
          <RefreshCw size={16} />
          {busy ? "処理中…" : "自動テーブル割り作成"}
        </button>
        <p className="text-sm text-slate-600">
          現在の設定: {seatsPerTable}人 / テーブル。直近2回の同席、リーダー配置、大業種のバランスを見ながら作成します。
        </p>
      </form>

      {ready && editor && <fieldset disabled={busy}><EditableTableAssignment
        key={`${meetingId}-${editor.revision}`}
        initialTables={editor.tables}
        score={editor.score}
        warnings={editor.warnings}
        restoreDraft={editor.restoreDraft}
        savedAt={editor.savedAt}
        storageKey={`draft-table-assignment-${meetingId}`}
        helperText="保存を押すと、運営全員が同じテーブル割りを編集できます。作業途中の変更はこの端末に保持されます。トップページと会員ページへの表示には、保存後に「公開する」を押してください。公開後はログインなしでも閲覧できます。"
        onSave={saveCurrentTables}
        members={members}
        participantStatuses={storedParticipants?.statuses ?? {}}
        seatsPerTable={seatsPerTable}
        onRefreshMembers={refreshAdditionMembers}
        onMarkAbsent={markAbsent}
      /></fieldset>}
    </div>
  );
}

function ReadOnlyTables({ tables }: { tables: AssignmentTable[] }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
