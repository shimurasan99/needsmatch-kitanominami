"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Crown, FileDown, FileText, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AssignmentSeat, AssignmentTable } from "@/types/domain";

function seatKey(seat: AssignmentSeat, index: number) {
  return seat.member?.id ?? `${seat.guestName ?? "guest"}-${index}`;
}

function sortTables(tables: AssignmentTable[]) {
  return [...tables].sort((a, b) => tableOrder(a.tableName) - tableOrder(b.tableName));
}

function tableOrder(tableName: string) {
  const label = tableName.match(/^[A-Z]+/)?.[0];
  return label ? labelToIndex(label) : 999;
}

function labelToIndex(label: string) {
  return label.split("").reduce((acc, character) => acc * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function printableSeatName(seat: AssignmentSeat) {
  return seat.member?.name ?? seat.guestName ?? "";
}

function printableSeatDetail(seat: AssignmentSeat) {
  return seat.member?.industry ?? seat.guestCompany ?? "ゲスト";
}

export function EditableTableAssignment({
  initialTables,
  score,
  warnings,
  storageKey,
  helperText,
  onSave
}: {
  initialTables: AssignmentTable[];
  score?: number;
  warnings?: string[];
  storageKey: string;
  helperText?: string;
  onSave?: (tables: AssignmentTable[], updatedAt: string) => void;
}) {
  const [tables, setTables] = useState<AssignmentTable[]>(() => sortTables(initialTables));
  const [saved, setSaved] = useState(false);

  const tableNames = useMemo(() => tables.map((table) => table.tableName), [tables]);

  useEffect(() => {
    setTables(sortTables(initialTables));
    setSaved(false);
  }, [initialTables]);

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
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(storageKey, JSON.stringify({ tables, updatedAt }));
    onSave?.(tables, updatedAt);
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

  function exportPdf() {
    const printedAt = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());

    const tableCards = tables.map((table) => {
      const rows = table.seats.map((seat, index) => `
        <tr>
          <td class="seat-number">${index + 1}</td>
          <td>
            <div class="name">${escapeHtml(printableSeatName(seat))}</div>
            <div class="detail">${escapeHtml(printableSeatDetail(seat))}</div>
          </td>
          <td class="leader">${seat.isLeader ? "リーダー" : ""}</td>
        </tr>
      `).join("");

      return `
        <section class="table-card">
          <div class="table-heading">
            <h2>${escapeHtml(table.tableName)}</h2>
            <span>${table.seats.length}名</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="seat-number">順番</th>
                <th>名前 / 会社・業種</th>
                <th class="leader">役割</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    }).join("");

    const printHtml = `
      <!doctype html>
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <title>テーブル割り</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #14324a;
              font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "YuGothic", "Noto Sans JP", sans-serif;
              background: #ffffff;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              align-items: flex-end;
              border-bottom: 2px solid #14324a;
              padding-bottom: 12px;
              margin-bottom: 18px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
              line-height: 1.35;
            }
            .meta {
              color: #64748b;
              font-size: 11px;
              font-weight: 700;
              text-align: right;
              white-space: nowrap;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }
            .table-card {
              break-inside: avoid;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
            }
            .table-heading {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #eef6f3;
              border-bottom: 1px solid #cbd5e1;
              padding: 8px 10px;
            }
            h2 {
              margin: 0;
              font-size: 16px;
              line-height: 1.3;
            }
            .table-heading span {
              color: #475569;
              font-size: 11px;
              font-weight: 800;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              border-bottom: 1px solid #e2e8f0;
              padding: 7px 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              color: #475569;
              background: #f8fafc;
              font-size: 10px;
              font-weight: 800;
            }
            tr:last-child td { border-bottom: 0; }
            .seat-number {
              width: 42px;
              text-align: center;
              white-space: nowrap;
            }
            .leader {
              width: 70px;
              text-align: center;
              color: #0f766e;
              font-weight: 800;
              white-space: nowrap;
            }
            .name {
              color: #14324a;
              font-size: 12px;
              font-weight: 800;
              line-height: 1.35;
            }
            .detail {
              margin-top: 2px;
              color: #64748b;
              font-size: 10px;
              line-height: 1.35;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>テーブル割り</h1>
            <div class="meta">出力日時<br />${escapeHtml(printedAt)}</div>
          </header>
          <main class="grid">${tableCards}</main>
          <script>
            window.addEventListener("load", () => {
              window.focus();
              window.setTimeout(() => window.print(), 300);
            });
          </script>
        </body>
      </html>
    `;
    const printUrl = window.URL.createObjectURL(new Blob([printHtml], { type: "text/html;charset=utf-8" }));
    const printWindow = window.open(printUrl, "_blank", "width=1024,height=768");
    if (!printWindow) {
      window.URL.revokeObjectURL(printUrl);
      window.alert("PDF出力用の画面を開けませんでした。ブラウザのポップアップ許可を確認してください。");
      return;
    }
    window.setTimeout(() => window.URL.revokeObjectURL(printUrl), 60000);
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
          <button type="button" onClick={exportPdf} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 px-4 py-2 text-sm font-bold">
            <FileText size={16} />
            PDF出力
          </button>
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
