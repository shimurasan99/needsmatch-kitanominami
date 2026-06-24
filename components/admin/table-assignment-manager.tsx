"use client";

import { Crown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EditableTableAssignment } from "@/components/table-assignment/editable-table-assignment";
import { applyMemberOverrides, readMemberOverrides } from "@/lib/data/member-overrides";
import { formatLocalUpdatedAt, storedParticipantsToParticipants, subscribeStoredParticipants } from "@/lib/data/participant-storage";
import { generateTableAssignment } from "@/lib/table-assignment/generator";
import type { AssignmentTable, Member, Participant } from "@/types/domain";

type StoredTableAssignment = {
  tables: AssignmentTable[];
  updatedAt: string;
};

function currentAssignmentStorageKey(meetingId: string) {
  return `nm_current_table_assignment_${meetingId}`;
}

function readCurrentAssignment(meetingId: string): StoredTableAssignment | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(currentAssignmentStorageKey(meetingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTableAssignment | AssignmentTable[];
    if (Array.isArray(parsed)) return { tables: parsed, updatedAt: "" };
    if (parsed && Array.isArray(parsed.tables)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCurrentAssignment(meetingId: string, value: StoredTableAssignment) {
  window.localStorage.setItem(currentAssignmentStorageKey(meetingId), JSON.stringify(value));
}

export function TableAssignmentManager({
  meetingId,
  initialMembers,
  initialParticipants,
  pastTables,
  initialSeatsPerTable
}: {
  meetingId: string;
  initialMembers: Member[];
  initialParticipants: Participant[];
  pastTables: AssignmentTable[];
  initialSeatsPerTable: number;
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [participantVersion, setParticipantVersion] = useState(0);
  const [seatsPerTable, setSeatsPerTable] = useState(initialSeatsPerTable);
  const [draftSeatsPerTable, setDraftSeatsPerTable] = useState(initialSeatsPerTable);
  const [currentAssignment, setCurrentAssignment] = useState<StoredTableAssignment | null>(null);

  useEffect(() => {
    setMembers(applyMemberOverrides(initialMembers, readMemberOverrides()));
    setCurrentAssignment(readCurrentAssignment(meetingId));
  }, [initialMembers, meetingId]);

  useEffect(() => {
    return subscribeStoredParticipants(meetingId, () => setParticipantVersion((current) => current + 1));
  }, [meetingId]);

  const generationParticipants = useMemo(() => {
    void participantVersion;
    return storedParticipantsToParticipants(meetingId, members, initialParticipants);
  }, [initialParticipants, meetingId, members, participantVersion]);

  const attendeesCount = useMemo(() => {
    return generationParticipants.filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length;
  }, [generationParticipants]);

  const generated = useMemo(() => {
    return generateTableAssignment(generationParticipants, members, pastTables, 1200, seatsPerTable);
  }, [generationParticipants, members, pastTables, seatsPerTable]);

  function generateTables(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSeatsPerTable(draftSeatsPerTable);
  }

  function saveCurrentTables(tables: AssignmentTable[], updatedAt: string) {
    const next = { tables, updatedAt };
    writeCurrentAssignment(meetingId, next);
    setCurrentAssignment(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">現在のテーブル割り</p>
            <h2 className="mt-1 text-2xl font-black text-deep">保存済みテーブル割り</h2>
            <p className="mt-1 text-sm text-slate-600">最終更新 {formatLocalUpdatedAt(currentAssignment?.updatedAt)}</p>
          </div>
          <div className="rounded bg-snow px-3 py-2 text-sm font-bold text-slate-600">参加設定: {attendeesCount}名</div>
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
        <button type="submit" className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-deep">
          <RefreshCw size={16} />
          自動テーブル割り作成
        </button>
        <p className="text-sm text-slate-600">
          現在の設定: {seatsPerTable}人 / テーブル。直近2回の同席、リーダー配置、大業種のバランスを見ながら作成します。
        </p>
      </form>

      <EditableTableAssignment
        initialTables={generated.tables}
        score={generated.score}
        warnings={generated.warnings}
        storageKey={`draft-table-assignment-${meetingId}-${seatsPerTable}`}
        helperText="保存を押すと、上の「現在のテーブル割り」に反映されます。メンバー横のプルダウンで別テーブルへ移動し、上下ボタンで同じテーブル内の順序を変更できます。"
        onSave={saveCurrentTables}
      />
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
