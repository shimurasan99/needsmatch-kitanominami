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
import type { AssignmentTable, Meeting, Member, Participant } from "@/types/domain";

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

function writeCurrentAssignment(meetingId: string, value: StoredTableAssignment) {
  window.localStorage.setItem(currentAssignmentStorageKey(meetingId), JSON.stringify({ ...value, tables: compactTableAssignment(value.tables) }));
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
  const [pastTables, setPastTables] = useState<AssignmentTable[]>([]);
  const [historyMessage, setHistoryMessage] = useState("");
  const [editor, setEditor] = useState<{ tables: AssignmentTable[]; score?: number; warnings?: string[]; revision: number; restoreDraft: boolean; savedAt?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);

  useEffect(() => {
    const { initialMembers, initialMeetings, initialSeatsPerTable } = initialData.current;
    let active = true;
    setReady(false);
    setError("");
    Promise.all([fetchManagedMembers(initialMembers), fetchStoredParticipants(meetingId), fetchSavedTableAssignments(), fetchPublishedTableAssignments(), fetchMeetings(initialMeetings)])
      .then(([nextMembers, participants, drafts, published, meetings]) => {
        if (!active) return;
        setMembers(nextMembers);
        setStoredParticipants(participants);
        const publication = published[meetingId];
        const saved = drafts[meetingId] ?? (publication ? { tables: publication.tables, updatedAt: publication.publishedAt } : null);
        setSavedVersion(drafts[meetingId]?.updatedAt ?? null);
        const local = readCurrentAssignment(meetingId);
        const initial = saved ?? local;
        setCurrentAssignment(saved);
        setPublishedAt(publication?.publishedAt);
        const size = initial?.seatsPerTable ?? initialSeatsPerTable;
        setSeatsPerTable(size);
        setDraftSeatsPerTable(size);
        setEditor({ tables: initial?.tables ?? [], revision: 0, restoreDraft: true, savedAt: saved?.updatedAt });
        const currentMeeting = meetings.find((meeting) => meeting.id === meetingId);
        const previous = currentMeeting ? meetings.filter((meeting) => meeting.status !== "下書き" && meeting.date < currentMeeting.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2) : [];
        const historyTables = (meeting: Meeting) => {
          const draft = drafts[meeting.id];
          const publication = published[meeting.id];
          return (draft && (!publication || draft.updatedAt >= publication.publishedAt) ? draft.tables : publication?.tables) ?? [];
        };
        setPastTables(previous.flatMap(historyTables));
        const missing = previous.filter((meeting) => !historyTables(meeting).some((table) => table.seats.length > 0));
        setHistoryMessage(!currentMeeting ? "定例会の日付が見つからず、過去2回の履歴を確認できません。" : missing.length ? `過去の定例会 ${missing.map((meeting) => meeting.date).join("、")} の保存済みテーブル割りがないため、その回の重複は確認できません。` : "");
        setReady(true);
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "テーブル割りの読み込みに失敗しました。"); });
    return () => { active = false; };
  }, [meetingId]);

  useEffect(() => {
    const refresh = () => {
      void fetchStoredParticipants(meetingId).then((value) => {
        setStoredParticipants(value);
        setParticipantVersion((current) => current + 1);
      }).catch((cause) => setError(cause instanceof Error ? cause.message : "参加者の読み込みに失敗しました。"));
    };
    refresh();
    return subscribeStoredParticipants(meetingId, refresh);
  }, [meetingId]);

  const generationParticipants = useMemo(() => {
    void participantVersion;
    return storedParticipantsValueToParticipants(meetingId, members, initialParticipants, storedParticipants);
  }, [initialParticipants, meetingId, members, participantVersion, storedParticipants]);

  const attendeesCount = useMemo(() => {
    return generationParticipants.filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length;
  }, [generationParticipants]);

  function generateTables(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    if (editor?.tables.some((table) => table.seats.length) && !window.confirm("編集中のテーブル割りを置き換えて、自動生成しますか？")) return;
    const generated = generateTableAssignment(generationParticipants, members, pastTables, 1200, draftSeatsPerTable);
    setSeatsPerTable(draftSeatsPerTable);
    setEditor((previous) => ({ ...generated, revision: (previous?.revision ?? 0) + 1, restoreDraft: false }));
    try { window.localStorage.setItem(`draft-table-assignment-${meetingId}`, JSON.stringify({ tables: compactTableAssignment(generated.tables), updatedAt: new Date().toISOString() })); } catch { /* Save button remains available. */ }
  }

  async function saveCurrentTables(tables: AssignmentTable[], updatedAt: string) {
    const next = { tables, updatedAt, seatsPerTable };
    await saveTableAssignment(meetingId, next, savedVersion);
    setSavedVersion(updatedAt);
    try { writeCurrentAssignment(meetingId, next); } catch { /* Server save succeeded. */ }
    setCurrentAssignment(next);
  }

  async function publishCurrentTables() {
    if (!currentAssignment || publishing) return;
    setPublishing(true);
    try {
      const latest = await fetchSavedTableAssignments();
      if ((latest[meetingId]?.updatedAt ?? null) !== savedVersion) throw new Error("別の運営担当者が保存内容を更新しました。再読み込みして最新のテーブル割りを確認してから公開してください。");
      const published = await publishTableAssignment(meetingId, currentAssignment.tables);
      setPublishedAt(published.publishedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "テーブル割りをサーバーへ公開できませんでした。");
    } finally { setPublishing(false); }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded bg-red-50 p-4 font-bold text-red-700">{error} <button type="button" onClick={() => window.location.reload()} className="underline">再読み込み</button></p>}
      {!ready && !error && <p role="status">保存済みのテーブル割りと参加者を読み込んでいます…</p>}
      {historyMessage && <p role="status" className="rounded bg-amber-50 p-4 text-amber-900">{historyMessage}</p>}
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
              disabled={!currentAssignment?.tables.some((table) => table.seats.length) || publishing || !ready}
              className="focus-ring inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {publishing ? "公開中…" : "保存済みの内容を公開する"}
            </button>
          </div>
        </div>

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
        <button type="submit" disabled={!ready || attendeesCount === 0} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-deep disabled:opacity-50">
          <RefreshCw size={16} />
          自動テーブル割り作成
        </button>
        <p className="text-sm text-slate-600">
          現在の設定: {seatsPerTable}人 / テーブル。直近2回の同席、リーダー配置、大業種のバランスを見ながら作成します。
        </p>
      </form>

      {ready && editor && <EditableTableAssignment
        key={`${meetingId}-${editor.revision}`}
        initialTables={editor.tables}
        score={editor.score}
        warnings={editor.warnings}
        restoreDraft={editor.restoreDraft}
        savedAt={editor.savedAt}
        storageKey={`draft-table-assignment-${meetingId}`}
        helperText="保存を押すと、運営全員が同じテーブル割りを編集できます。作業途中の変更はこの端末に保持されます。会員向けの表示には、保存後に「公開する」を押してください。"
        onSave={saveCurrentTables}
      />}
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
