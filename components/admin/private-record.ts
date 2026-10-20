"use client";
import { useCallback, useEffect, useState } from "react";

export const adminInput = "w-full rounded border border-slate-300 bg-white p-2 text-base";
export const adminButton = "rounded border border-slate-300 bg-white px-4 py-2 font-bold disabled:opacity-50";
export async function adminJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "通信に失敗しました。");
  return result;
}
export function usePrivateRecord<T>(key: string) {
  const [data, setData] = useState<T | null>(null), [version, setVersion] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError(""); setMessage(""); setDirty(false);
    adminJson(`/api/admin/records/${key}`).then(r => { if (active) { setData(r.data); setVersion(r.version); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [key, revision]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("a[href]") && !window.confirm("未保存の変更があります。移動しますか？")) { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
  const change = useCallback((next: T) => { setData(next); setDirty(true); setMessage(""); }, []);
  async function save() {
    if (busy || !data) return; setBusy(true); setError(""); setMessage("");
    try {
      const r = await adminJson(`/api/admin/records/${key}`, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": version ?? "new" }, body: JSON.stringify(data) });
      setData(r.data); setVersion(r.version); setDirty(false); setMessage("サーバーに保存しました。ほかの端末でも読み込めます。");
    } catch (e) { setError(e instanceof Error ? e.message : "保存失敗"); } finally { setBusy(false); }
  }
  const canLeave = () => !dirty || window.confirm("未保存の変更を破棄して切り替えますか？");
  return { data, version, dirty, busy, error, message, change, save, canLeave, reload: () => { if (canLeave()) setRevision(v => v + 1); } };
}
