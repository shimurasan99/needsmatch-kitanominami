"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Crown, FileDown, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { AssignmentSeat, AssignmentTable } from "@/types/domain";

const tableOrderLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

function seatKey(seat: AssignmentSeat, index: number) {
  return seat.member?.id ?? `${seat.guestName ?? "guest"}-${index}`;
}

function sortTables(tables: AssignmentTable[]) {
  return [...tables].sort((a, b) => tableOrder(a.tableName) - tableOrder(b.tableName));
}

function tableOrder(tableName: string) {
  const label = tableName.match(/[A-H]/)?.[0];
  const index = label ? tableOrderLabels.indexOf(label) : -1;
  return index >= 0 ? index : 999;
}

export function EditableTableAssignment({
  initialTables,
  score,
  warnings,
  storageKey,
  helperText
}: {
  initialTables: AssignmentTable[];
  score?: number;
  warnings?: string[];
  storageKey: string;
  helperText?: string;
}) {
  const [tables, setTables] = useState<AssignmentTable[]>(() => sortTables(initialTables));
  const [saved, setSaved] = useState(false);

  const tableNames = useMemo(() => tables.map((table) => table.tableName), [tables]);

  function moveSeat(fromTableName: string, seatIndex: number, toTableName: string) {
    if (fromTableName === toTableName) return;
    setSaved(false);
    setTables((current) => {
      const next = current.map((table) => ({ ...table, seats: [...table.seats] }));
      const from = next.find((table) => table.tableName === fromTableName);
      const to = next.find((table) => table.tableName === toTableName);
      if (!from || !to) return current;
      const [seat] = from.seats.splice(seatIndex, 1);
      if (seat) to.seats.push(seat);
      return sortTables(next);
    });
  }

  function reorderSeat(tableName: string, seatIndex: number, delta: number) {
    setSaved(false);
    setTables((current) => {
      const next = current.map((table) => ({ ...table, seats: [...table.seats] }));
      const table = next.find((item) => item.tableName === tableName);
      if (!table) return current;
      const targetIndex = seatIndex + delta;
      if (targetIndex < 0 || targetIndex >= table.seats.length) return current;
      [table.seats[seatIndex], table.seats[targetIndex]] = [table.seats[targetIndex], table.seats[seatIndex]];
      return sortTables(next);
    });
  }

  function saveTables() {
    window.localStorage.setItem(storageKey, JSON.stringify(tables));
    setSaved(true);
  }

  function exportCsv() {
    const rows = [["テーブル", "順番", "名前", "会社/業種", "リーダー"]];
    tables.forEach((table) => {
      table.seats.forEach((seat, index) => {
        rows.push([
          table.tableName,
          String(index + 1),
          seat.member?.name ?? seat.guestName ?? "",
          seat.member?.industry ?? seat.guestCompany ?? "",
          seat.isLeader ? "リーダー" : ""
        ]);
      });
    });
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${storageKey}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-slate-500">最適化スコア</p>
          <p className="text-2xl font-black text-deep">{score ?? "-"}</p>
          {helperText && <p className="mt-1 text-sm text-slate-600">{helperText}</p>}
          {saved && <p className="mt-2 text-sm font-bold text-forest">保存しました。</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={saveTables} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white">
            <Save size={16} />
            保存
          </button>
          <button type="button" className="focus-ring rounded border border-slate-200 px-4 py-2 text-sm font-bold">公開切替</button>
          <button type="button" className="focus-ring rounded border border-slate-200 px-4 py-2 text-sm font-bold">PDF出力</button>
          <button type="button" onClick={exportCsv} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 px-4 py-2 text-sm font-bold">
            <FileDown size={16} />
            CSV出力
          </button>
        </div>
      </div>
      {warnings && warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle size={18} />条件違反の警告</div>
          <ul className="grid gap-1">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {tables.map((table) => (
          <article key={table.tableName} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-deep">{table.tableName}</h2>
              <span className="rounded bg-snow px-3 py-1 text-xs font-bold text-slate-600">{table.seats.length}名</span>
            </div>
            <div className="grid gap-2">
              {table.seats.map((seat, index) => (
                <div key={`${table.tableName}-${seatKey(seat, index)}`} className="rounded bg-snow p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-deep">{seat.member?.name ?? seat.guestName}</p>
                      <p className="text-xs text-slate-600">{seat.member?.industry ?? seat.guestCompany ?? "ゲスト"}</p>
                    </div>
                    {seat.isLeader && <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-bold text-forest"><Crown size={14} />リーダー</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => reorderSeat(table.tableName, index, -1)} className="focus-ring rounded border border-slate-200 bg-white p-2 text-deep disabled:opacity-40" disabled={index === 0} aria-label="上へ移動">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" onClick={() => reorderSeat(table.tableName, index, 1)} className="focus-ring rounded border border-slate-200 bg-white p-2 text-deep disabled:opacity-40" disabled={index === table.seats.length - 1} aria-label="下へ移動">
                      <ArrowDown size={15} />
                    </button>
                    <select
                      defaultValue={table.tableName}
                      onChange={(event) => moveSeat(table.tableName, index, event.target.value)}
                      className="focus-ring rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                    >
                      {tableNames.map((name) => <option key={name} value={name}>{name}に移動</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
