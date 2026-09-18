"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Crown, FileDown, FileText, Plus, RefreshCw, Save, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AssignmentSeat, AssignmentTable, Member } from "@/types/domain";
import { csvCell } from "@/lib/data/csv-export";
import { compactTableAssignment } from "@/lib/table-assignment/snapshot";
import { addEmptyTable, addGuestToTable, addMemberToTable, getUnassignedMembers, nextTableName } from "@/lib/table-assignment/manual-addition";
import { removeSeatFromTable } from "@/lib/table-assignment/manual-absence";

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
  restoreDraft = true,
  savedAt,
  helperText,
  onSave,
  members = [],
  participantStatuses = {},
  seatsPerTable,
  onRefreshMembers,
  onMarkAbsent
}: {
  initialTables: AssignmentTable[];
  score?: number;
  warnings?: string[];
  storageKey: string;
  restoreDraft?: boolean;
  savedAt?: string;
  helperText?: string;
  onSave?: (tables: AssignmentTable[], updatedAt: string) => void | Promise<void>;
  members?: Member[];
  participantStatuses?: Record<string, string>;
  seatsPerTable?: number;
  onRefreshMembers?: () => Promise<void>;
  onMarkAbsent?: (seat: AssignmentSeat) => Promise<{ attendanceUpdated: boolean }>;
}) {
  const [tables, setTables] = useState<AssignmentTable[]>(() => {
    if (restoreDraft && typeof window !== "undefined") {
      try {
        const draft = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
        if (draft && Array.isArray(draft.tables) && (!savedAt || draft.updatedAt > savedAt)) return sortTables(draft.tables);
      } catch { /* A missing or invalid local draft does not prevent editing. */ }
    }
    return sortTables(initialTables);
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const edited = useRef(false);
  const savingRef = useRef(false);
  const addingRef = useRef(false);
  const refreshingRef = useRef(false);
  const [additionalMemberId, setAdditionalMemberId] = useState("");
  const [additionalTableName, setAdditionalTableName] = useState("");
  const [additionMessage, setAdditionMessage] = useState("");
  const [recentAddition, setRecentAddition] = useState<{ id: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [guestTableName, setGuestTableName] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualError, setManualError] = useState("");
  const [recentGuest, setRecentGuest] = useState<{ name: string; company: string } | null>(null);
  const [recentTable, setRecentTable] = useState<string | null>(null);
  const [absenceTarget, setAbsenceTarget] = useState<{ tableName: string; index: number; seat: AssignmentSeat } | null>(null);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [absenceError, setAbsenceError] = useState("");
  const [absenceMessage, setAbsenceMessage] = useState("");
  const absenceRef = useRef(false);
  const absenceDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!absenceTarget) return;
    const dialog = absenceDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector?.<HTMLButtonElement>("[data-absence-cancel]")?.focus();
    return () => dialog.close();
  }, [absenceTarget]);

  async function confirmAbsence() {
    if (!absenceTarget || !onMarkAbsent || absenceRef.current || savingRef.current || refreshingRef.current) return;
    absenceRef.current = true;
    setMarkingAbsent(true);
    setAbsenceError("");
    try {
      const next = removeSeatFromTable(tables, absenceTarget.tableName, absenceTarget.index, absenceTarget.seat);
      const result = await onMarkAbsent(absenceTarget.seat);
      const name = printableSeatName(absenceTarget.seat);
      edited.current = true;
      setTables(next);
      setSaved(false);
      setError("");
      setRecentAddition(null);
      setRecentGuest(null);
      setAdditionMessage("");
      setManualMessage("");
      setAbsenceMessage(result.attendanceUpdated
        ? `${name}さんの出欠を「欠席」で保存し、編集中の配置から外しました。他の配置は変更していません。テーブル割りはまだ未保存です。「保存」→「保存済みの内容を公開する」を押してください。`
        : `${name}さんを編集中の配置から外しました。参加者名簿に一致するゲスト登録がないため、出欠回答は変更していません。他の配置はそのままです。「保存」→「保存済みの内容を公開する」を押してください。`);
      setAbsenceTarget(null);
    } catch (cause) {
      setAbsenceError(`${cause instanceof Error ? cause.message : "欠席に変更できませんでした。"} 配置は保持しています。出欠は保存済みの場合があるため、最新の出欠を確認してから再実行してください。`);
    } finally { absenceRef.current = false; setMarkingAbsent(false); }
  }

  const tableNames = useMemo(() => tables.map((table) => table.tableName), [tables]);
  const unassignedMembers = useMemo(() => getUnassignedMembers(tables, members), [tables, members]);
  const selectedMember = unassignedMembers.find((member) => member.id === additionalMemberId);
  const selectedTable = tables.find((table) => table.tableName === additionalTableName);
  const exceedsCapacity = !!selectedMember && !!selectedTable && !!seatsPerTable && selectedTable.seats.length >= seatsPerTable;
  const guestTable = tables.find((table) => table.tableName === guestTableName);
  const guestExceedsCapacity = !!guestName.trim() && !!guestTable && !!seatsPerTable && guestTable.seats.length >= seatsPerTable;
  const canUndoTable = recentTable !== null && tables.some((table) => table.tableName === recentTable && table.seats.length === 0);

  useEffect(() => { addingRef.current = false; }, [tables]);

  function addTable() {
    if (absenceRef.current) return;
    if (savingRef.current || refreshingRef.current || addingRef.current) return;
    addingRef.current = true;
    try {
      const next = addEmptyTable(tables);
      const name = next[next.length - 1].tableName;
      edited.current = true;
      setTables(next);
      setSaved(false);
      setError("");
      setManualError("");
      setRecentTable(name);
      setGuestTableName(name);
      setAdditionalTableName(name);
      setManualMessage(`${name}を追加しました。ゲストの入力や既存の参加者の移動ができます。変更後は「保存」を押してください。`);
    } catch (cause) {
      addingRef.current = false;
      setManualError(cause instanceof Error ? cause.message : "テーブルを追加できませんでした。");
    }
  }

  function addGuest() {
    if (absenceRef.current) return;
    if (savingRef.current || refreshingRef.current || addingRef.current) return;
    addingRef.current = true;
    try {
      const next = addGuestToTable(tables, guestName, guestCompany, guestTableName);
      edited.current = true;
      setTables(next);
      setSaved(false);
      setError("");
      setManualError("");
      setRecentGuest({ name: guestName.trim(), company: guestCompany.trim() });
      setManualMessage(`${guestName.trim()}さんを${guestTableName}の末尾に追加しました。「保存」で運営全員に共有し、保存後に公開すると会員ページにも反映されます。`);
      setGuestName("");
      setGuestCompany("");
    } catch (cause) {
      addingRef.current = false;
      setManualError(cause instanceof Error ? cause.message : "ゲストを追加できませんでした。");
    }
  }

  function undoRecentGuest() {
    if (absenceRef.current) return;
    if (!recentGuest || savingRef.current || refreshingRef.current || addingRef.current) return;
    edited.current = true;
    setSaved(false);
    setTables((current) => current.map((table) => ({ ...table, seats: table.seats.filter((seat) => !(!seat.member && seat.guestName?.trim() === recentGuest.name && (seat.guestCompany ?? "").trim() === recentGuest.company)) })));
    setManualError("");
    setManualMessage(`${recentGuest.name}さんの直前の追加を取り消しました。他の配置は変更していません。`);
    setRecentGuest(null);
  }

  function undoRecentTable() {
    if (absenceRef.current) return;
    if (!canUndoTable || savingRef.current || refreshingRef.current || addingRef.current) return;
    edited.current = true;
    setSaved(false);
    setTables((current) => current.filter((table) => table.tableName !== recentTable || table.seats.length > 0));
    setManualError("");
    setManualMessage(`${recentTable}の追加を取り消しました。他の配置は変更していません。`);
    setRecentTable(null);
  }

  function addSelectedMember() {
    if (absenceRef.current) return;
    if (savingRef.current || refreshingRef.current || addingRef.current || !selectedMember || !selectedTable) return;
    addingRef.current = true;
    try {
      const next = addMemberToTable(tables, selectedMember, selectedTable.tableName);
      edited.current = true;
      setTables(next);
      setSaved(false);
      setError("");
      setAdditionMessage(`${selectedMember.name}さんを${selectedTable.tableName}の末尾に追加しました。「保存」を押すと運営全員に共有されます。会員向けには保存後に公開してください。`);
      setAdditionalMemberId("");
      setRecentAddition({ id: selectedMember.id, name: selectedMember.name });
    } catch (cause) {
      addingRef.current = false;
      setError(cause instanceof Error ? cause.message : "会員を追加できませんでした。");
    }
  }

  function undoRecentAddition() {
    if (absenceRef.current) return;
    if (!recentAddition || savingRef.current || refreshingRef.current || addingRef.current) return;
    edited.current = true;
    setSaved(false);
    setTables((current) => current.map((table) => ({ ...table, seats: table.seats.filter((seat) => seat.member?.id !== recentAddition.id) })));
    setAdditionMessage(`${recentAddition.name}さんの直前の追加を取り消しました。他の配置と出欠回答は変更していません。`);
    setRecentAddition(null);
  }

  async function refreshMembers() {
    if (absenceRef.current) return;
    if (!onRefreshMembers || savingRef.current || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    try {
      await onRefreshMembers();
      setAdditionMessage("会員名簿・出欠を最新の状態に更新しました。編集中のテーブル割りは変更していません。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "会員名簿を更新できませんでした。編集中の配置は保持しています。");
    } finally { refreshingRef.current = false; setRefreshing(false); }
  }

  useEffect(() => {
    if (!edited.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ tables: compactTableAssignment(tables), updatedAt: new Date().toISOString() }));
    } catch { setError("この端末へ作業途中の内容を保存できません。画面を閉じる前に「保存」を押してください。"); }
  }, [tables, storageKey]);

  function moveSeat(fromTableName: string, seatIndex: number, toTableName: string) {
    if (absenceRef.current) return;
    if (fromTableName === toTableName) return;
    edited.current = true;
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
    if (absenceRef.current) return;
    edited.current = true;
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

  async function saveTables() {
    if (absenceRef.current) return;
    if (savingRef.current || refreshingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const updatedAt = new Date().toISOString();
    try {
      await onSave?.(tables, updatedAt);
      try { window.localStorage.setItem(storageKey, JSON.stringify({ tables: compactTableAssignment(tables), updatedAt })); } catch { /* Server save succeeded. */ }
      setSaved(true);
      setRecentAddition(null);
      setAdditionMessage("");
      setRecentGuest(null);
      setRecentTable(null);
      setManualMessage("");
      setManualError("");
      setAbsenceMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。もう一度お試しください。");
    } finally { savingRef.current = false; setSaving(false); }
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
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
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
            .honorific-note {
              margin-top: 4px;
              color: #64748b;
              font-size: 12px;
              font-weight: 800;
              line-height: 1.4;
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
            <div>
              <h1>テーブル割り</h1>
              <div class="honorific-note">敬称略</div>
            </div>
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
      <fieldset disabled={markingAbsent} className="grid min-w-0 gap-5">
      {onMarkAbsent && <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p>急な欠席は、各参加者の「欠席にする」から変更できます。他の配置は維持します。出欠変更後、配置の「保存」と会員向けの「公開」も行ってください。</p>
        {absenceMessage && <p role="status" className="mt-2 font-bold">{absenceMessage}</p>}
      </div>}
      <section aria-label="ゲストとテーブルを手動で追加" className="min-w-0 rounded border border-blue-200 bg-blue-50 p-4 sm:p-5">
        <h2 className="text-lg font-black text-deep">ゲスト・テーブルを手動で追加</h2>
        <p className="mt-2 text-sm text-slate-700">既存の配置はそのままで、空のテーブルを増やしたり、ゲストを追加できます。自動生成をやり直す必要はありません。</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={addTable} disabled={saving || refreshing} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><Plus size={17} />{nextTableName(tables)}を追加</button>
          {recentTable && <button type="button" onClick={undoRecentTable} disabled={saving || refreshing || !canUndoTable} className="focus-ring rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">直前の空テーブル追加を取り消す</button>}
        </div>
        {recentTable && !canUndoTable && <p className="mt-2 text-sm text-slate-600">追加したテーブルに参加者がいるため取り消せません。先に別のテーブルへ移動してください。</p>}
        <fieldset disabled={saving || refreshing || !tables.length} className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2"><span className="text-sm font-bold text-deep">ゲストの氏名</span><input type="text" value={guestName} maxLength={100} onChange={(event) => setGuestName(event.target.value)} placeholder="氏名を入力" className="focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-3 text-sm" /></label>
          <label className="grid min-w-0 gap-2"><span className="text-sm font-bold text-deep">ゲストの会社名（任意）</span><input type="text" value={guestCompany} maxLength={100} onChange={(event) => setGuestCompany(event.target.value)} placeholder="会社名などを入力" className="focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-3 text-sm" /></label>
          <label className="grid min-w-0 gap-2 sm:col-span-2"><span className="text-sm font-bold text-deep">ゲストの追加先テーブル</span><select value={guestTable?.tableName ?? ""} onChange={(event) => setGuestTableName(event.target.value)} className="focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">テーブルを選択してください</option>{tables.map((table) => <option key={table.tableName} value={table.tableName}>{table.tableName}（現在{table.seats.length}名）</option>)}</select></label>
          {guestExceedsCapacity && <p role="status" className="rounded bg-amber-100 p-3 text-sm font-bold text-amber-900 sm:col-span-2">追加すると{guestTable!.seats.length + 1}名になり、設定の{seatsPerTable}名を超えます。会場の席数を確認して追加してください。</p>}
          <button type="button" onClick={addGuest} disabled={!guestName.trim() || !guestTable} className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"><UserPlus size={17} />ゲストをテーブルに追加</button>
        </fieldset>
        {!tables.length && <p className="mt-3 text-sm font-bold text-slate-600">まず空のテーブルを追加してください。</p>}
        <p className="mt-3 text-sm text-slate-700">ここでのゲスト追加はテーブル割りだけに反映します。参加者名簿にも必要な場合は「参加者管理」に登録してください。自動生成をやり直す際は参加者管理の名簿が使われます。</p>
        {manualError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{manualError}</p>}
        {manualMessage && <p role="status" className="mt-3 text-sm font-bold text-deep">{manualMessage}</p>}
        {recentGuest && <button type="button" onClick={undoRecentGuest} disabled={saving || refreshing} className="focus-ring mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">直前のゲスト追加を取り消す</button>}
      </section>
      {onRefreshMembers && <section aria-label="会員を手動で追加" className="min-w-0 rounded border border-blue-200 bg-blue-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-deep">急遽参加する会員を手動で追加</h2>
          <button type="button" onClick={refreshMembers} disabled={saving || refreshing} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">
            <RefreshCw size={16} />{refreshing ? "名簿を更新中…" : "会員名簿・出欠を更新"}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-700">既存の配置は変えず、選んだテーブルの末尾に1名追加します。追加済みの会員は候補から除外されます。</p>
        <p className="mt-1 text-sm text-slate-700">この操作では出欠回答は変更しません。未定・欠席の場合は「参加者管理」で参加に変更してください。手動追加後の同席重複は自動調整しません。</p>
        {!tables.length ? <p className="mt-3 font-bold text-slate-600">追加先のテーブルがありません。先にテーブル割りを作成してください。</p> : <fieldset disabled={saving || refreshing} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-bold text-deep">追加する会員</span>
            <select value={selectedMember?.id ?? ""} onChange={(event) => setAdditionalMemberId(event.target.value)} className="focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-3 text-sm">
              <option value="">会員を選択してください</option>
              {unassignedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}（No.{member.memberNo} / {participantStatuses[member.id] === "キャンセル" ? "欠席" : participantStatuses[member.id] ?? "未回答"}）</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-bold text-deep">追加先のテーブル</span>
            <select value={selectedTable?.tableName ?? ""} onChange={(event) => setAdditionalTableName(event.target.value)} className="focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-3 text-sm">
              <option value="">テーブルを選択してください</option>
              {tables.map((table) => <option key={table.tableName} value={table.tableName}>{table.tableName}（現在{table.seats.length}名）</option>)}
            </select>
          </label>
          {unassignedMembers.length === 0 && <p className="text-sm font-bold text-slate-600 sm:col-span-2">追加できる未配置の在籍会員はいません。新規登録後は「会員名簿・出欠を更新」を押してください。</p>}
          {exceedsCapacity && <p role="status" className="rounded bg-amber-100 p-3 text-sm font-bold text-amber-900 sm:col-span-2">追加すると{selectedTable!.seats.length + 1}名になり、設定の{seatsPerTable}名を超えます。会場の席数を確認して追加してください。</p>}
          <button type="button" onClick={addSelectedMember} disabled={!selectedMember || !selectedTable} className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">
            <UserPlus size={17} />選んだ会員をテーブルに追加
          </button>
        </fieldset>}
        {additionMessage && <p role="status" className="mt-3 text-sm font-bold text-deep">{additionMessage}</p>}
        {recentAddition && <button type="button" onClick={undoRecentAddition} disabled={saving || refreshing} className="focus-ring mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">直前の追加を取り消す</button>}
      </section>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-slate-500">最適化スコア</p>
          <p className="text-2xl font-black text-deep">{edited.current ? "手動調整中" : score ?? "-"}</p>
          {helperText && <p className="mt-1 text-sm text-slate-600">{helperText}</p>}
          {saved && <p className="mt-2 text-sm font-bold text-forest">保存しました。</p>}
          {error && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={saveTables} disabled={saving || refreshing || !tables.length} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} />
            {saving ? "保存中…" : "保存"}
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
      {!edited.current && warnings && warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle size={18} />条件違反の警告</div>
          <ul className="grid gap-1">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      <fieldset disabled={saving} className="grid gap-4 lg:grid-cols-2">
        {tables.map((table) => (
          <article key={table.tableName} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-deep">{table.tableName}</h2>
              <span className="rounded bg-snow px-3 py-1 text-xs font-bold text-slate-600">{table.seats.length}名</span>
            </div>
            <div className="grid gap-2">
              {table.seats.length === 0 && <p className="rounded bg-snow p-3 text-sm text-slate-600">空のテーブルです。ゲスト・会員の追加や他のテーブルからの移動ができます。</p>}
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
                      aria-label={`${seat.member?.name ?? seat.guestName ?? "参加者"}の移動先テーブル`}
                      value={table.tableName}
                      onChange={(event) => moveSeat(table.tableName, index, event.target.value)}
                      className="focus-ring rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                    >
                      {tableNames.map((name) => <option key={name} value={name}>{name}に移動</option>)}
                    </select>
                    {onMarkAbsent && <button type="button" aria-label={`${printableSeatName(seat)}を欠席にする`} onClick={() => { setAbsenceError(""); setAbsenceTarget({ tableName: table.tableName, index, seat }); }} className="focus-ring rounded border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">欠席にする</button>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </fieldset>
      </fieldset>
      <dialog ref={absenceDialogRef} aria-label="欠席への変更を確認" aria-describedby="absence-description" className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded border-0 bg-white p-5 shadow-soft backdrop:bg-slate-950/60" onCancel={(event) => { if (absenceRef.current) event.preventDefault(); else setAbsenceTarget(null); }}>
        {absenceTarget && <>
          <h2 className="text-xl font-black text-deep">欠席に変更しますか？</h2>
          <div id="absence-description" className="mt-3 grid gap-2 text-sm text-slate-700">
            <p className="font-bold">{printableSeatName(absenceTarget.seat)}さん（{absenceTarget.tableName}）</p>
            <p>{absenceTarget.seat.member ? "出欠を「欠席」に保存し、この方だけを編集中の配置から外します。" : "参加者名簿に氏名・会社表示が一致するゲストが1名いる場合は、出欠も「欠席」に保存します。名簿に登録のないゲストは配置からのみ外します。"}</p>
            <p>残りの配置は変えません。配置の変更は、この後に「保存」と「公開」が必要です。</p>
          </div>
          {absenceError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{absenceError}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button data-absence-cancel type="button" disabled={markingAbsent} onClick={() => setAbsenceTarget(null)} className="focus-ring rounded border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50">キャンセル</button>
            <button type="button" disabled={markingAbsent} onClick={confirmAbsence} className="focus-ring rounded bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{markingAbsent ? "変更中…" : "欠席にして配置から外す"}</button>
          </div>
        </>}
      </dialog>
    </div>
  );
}
