"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchSharedState, updateSharedState } from "@/lib/data/shared-state";
import { mergeEditedRecords } from "@/lib/data/merge-edited-records";

export type MessengerThread = { id: string; name: string; url: string };

export function ThreadManager({ initialThreads }: { initialThreads: MessengerThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSharedState<MessengerThread[]>("threads").then((value) => { if (active) { setThreads(value ?? initialThreads); setIsLoaded(true); } }).catch(() => { if (active) setMessage("共有データを読み込めませんでした。再読み込みしてください。"); });
    return () => { active = false; };
  }, [initialThreads]);

  function openForm(thread?: MessengerThread) {
    setEditingId(thread?.id ?? "new");
    setName(thread?.name ?? "");
    setUrl(thread?.url ?? "");
    setMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving || !isLoaded || !editingId) return;
    if (!name.trim() || !/^https?:\/\//i.test(url)) { setMessage("名称と、httpから始まるURLを入力してください。"); return; }
    const next = editingId === "new"
      ? [...threads, { id: `thread-${crypto.randomUUID()}`, name: name.trim(), url: url.trim() }]
      : threads.map((thread) => thread.id === editingId ? { ...thread, name: name.trim(), url: url.trim() } : thread);
    setIsSaving(true);
    try { const saved = await updateSharedState<MessengerThread[]>("threads", (current) => mergeEditedRecords(current ?? initialThreads, threads, next)); setThreads(saved); setEditingId(null); setMessage("保存しました。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "保存できませんでした。"); }
    finally { setIsSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteId || isSaving || !isLoaded) return;
    const next = threads.filter((thread) => thread.id !== deleteId);
    setIsSaving(true);
    try { const saved = await updateSharedState<MessengerThread[]>("threads", (current) => mergeEditedRecords(current ?? initialThreads, threads, next)); setThreads(saved); setDeleteId(null); setMessage("削除しました。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "削除できませんでした。"); }
    finally { setIsSaving(false); }
  }

  return <fieldset disabled={!isLoaded || isSaving}>
    <button type="button" onClick={() => openForm()} className="focus-ring mb-4 rounded bg-forest px-4 py-2 text-sm font-bold text-white">スレッド追加</button>
    {message && <p className="mb-4 rounded border border-slate-200 bg-white p-3 text-sm font-bold">{message}</p>}
    {editingId && <form onSubmit={submit} className="mb-4 grid gap-3 rounded border border-slate-200 bg-white p-4">
      <label className="grid gap-2"><span className="font-bold">名称</span><input value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2" /></label>
      <label className="grid gap-2"><span className="font-bold">URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} className="rounded border px-3 py-2" /></label>
      <div className="flex gap-2"><button className="rounded bg-forest px-4 py-2 font-bold text-white">保存</button><button type="button" onClick={() => setEditingId(null)} className="rounded border px-4 py-2 font-bold">キャンセル</button></div>
    </form>}
    <div className="grid gap-3">{threads.map((thread) => <div key={thread.id} className="rounded border border-slate-200 bg-white p-4">
      <p className="font-bold text-deep">{thread.name}</p><p className="mt-1 break-all text-sm text-slate-600">{thread.url}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => openForm(thread)} className="rounded border px-3 py-1 text-sm font-bold">編集</button><button type="button" onClick={() => setDeleteId(thread.id)} className="rounded border border-red-200 px-3 py-1 text-sm font-bold text-red-700">削除</button></div>
    </div>)}</div>
    {deleteId && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded bg-white p-6"><h2 className="text-xl font-black">本当に削除しますか？</h2><p className="mt-3">このスレッドを削除します。</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteId(null)} className="rounded border px-4 py-2 font-bold">キャンセル</button><button onClick={confirmDelete} className="rounded bg-red-600 px-4 py-2 font-bold text-white">削除を確定する</button></div></div></div>}
  </fieldset>;
}
