"use client";
import { useState } from "react";
import { adminButton as button, adminInput as input, usePrivateRecord } from "./private-record";
import type { RoutineRecord, RoutineTask } from "@/lib/admin/routine-record";
import { validMonth } from "@/lib/admin/routine-record";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export function RoutineManager() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const r = usePrivateRecord<RoutineRecord>(`routines-${month}`);
  const update = (id: string, patch: Partial<RoutineTask>) => r.data && r.change({ tasks: r.data.tasks.map(t => t.id === id ? { ...t, ...patch } : t) });
  return <div className="space-y-5">
    <p>月ごとに担当者・期限・完了状況を保存します。新しい月は18項目のひな形から始まり、過去の月の記録は残ります。担当者は原文の参考値です。各月の担当を確認してください。</p>
    <a className="text-forest underline" target="_blank" rel="noreferrer" href="https://docs.google.com/document/d/1dd6vodApi3XRTkPJG-pe3TrdfuEQXv8EnjVMgfBg_KY/edit?tab=t.0">原文：毎月のルーティン</a>
    <label className="block max-w-xs">対象月<input type="month" className={input} value={month} disabled={r.busy} onChange={e => { if (validMonth(e.target.value) && r.canLeave()) setMonth(e.target.value); }} /></label>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={!r.data || r.busy} onClick={r.save}>この月のタスクを保存</button><button className={button} disabled={r.busy} onClick={r.reload}>再読み込み</button>{r.dirty && <span>未保存の変更あり</span>}</div>
    {r.error && <p role="alert" className="text-red-700">{r.error}</p>}{r.message && <p role="status">{r.message}</p>}
    {!r.data && !r.error && <p>読み込み中…</p>}
    {r.data && <fieldset disabled={r.busy} className="space-y-3">
      <p className="font-bold">{r.data.tasks.filter(t => t.done).length} / {r.data.tasks.length} 完了 {r.version ? "" : "（この月は未保存）"}</p>
      {r.data.tasks.map(t => <article key={t.id} className={`space-y-3 rounded border p-4 ${t.done ? "bg-green-50" : "bg-white"}`}>
        <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5" checked={t.done} onChange={e => update(t.id, { done: e.target.checked, completedDate: e.target.checked ? today() : "" })} />{t.title}</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>タスク名<input className={input} value={t.title} maxLength={300} onChange={e => update(t.id, { title: e.target.value })} /></label>
          <label>担当者<input className={input} value={t.owner} maxLength={200} onChange={e => update(t.id, { owner: e.target.value })} /></label>
          <label>完了時期の目安<input className={input} value={t.timing} maxLength={300} onChange={e => update(t.id, { timing: e.target.value })} /></label>
          <label>期限<input className={input} type="date" value={t.dueDate} onChange={e => update(t.id, { dueDate: e.target.value })} /></label>
          <label>完了日<input className={input} type="date" value={t.completedDate} onChange={e => update(t.id, { completedDate: e.target.value })} /></label>
          <label>結果・確認メモ<textarea className={input} value={t.note} maxLength={4000} onChange={e => update(t.id, { note: e.target.value })} /></label>
        </div>
        <button className={`${button} text-sm`} onClick={() => { if (confirm(`「${t.title}」をこの月の一覧から削除しますか？保存時に反映されます。`)) r.change({ tasks: r.data!.tasks.filter(v => v.id !== t.id) }); }}>この月から削除</button>
      </article>)}
      <button className={button} onClick={() => r.change({ tasks: [...r.data!.tasks, { id: crypto.randomUUID(), title: "追加タスク", owner: "", timing: "", dueDate: "", completedDate: "", done: false, note: "" }] })}>タスクを追加</button>
      <button className={`${button} ml-3`} onClick={r.save}>この月のタスクを保存</button>
    </fieldset>}
  </div>;
}
