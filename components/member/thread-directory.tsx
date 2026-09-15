"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchSharedState } from "@/lib/data/shared-state";
import type { MessengerThread } from "@/components/admin/thread-manager";

export function ThreadDirectory({ initialThreads }: { initialThreads: MessengerThread[] }) {
  const [threads, setThreads] = useState<MessengerThread[]>([]);
  const [message, setMessage] = useState("スレッドを読み込んでいます...");
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void fetchSharedState<MessengerThread[]>("threads").then((value) => { if (active && request === revision) { setThreads(value ?? initialThreads); setMessage(""); } }).catch((error) => { if (active && request === revision) setMessage(error instanceof Error ? error.message : "スレッドを読み込めませんでした。"); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [initialThreads]);
  return <div className="mt-6 grid gap-3">{message && <p className="text-sm text-slate-600">{message}</p>}{!message && !threads.length && <p className="text-sm text-slate-600">現在公開されているスレッドはありません。</p>}{threads.map((thread) => <div key={thread.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4"><p className="font-bold text-deep">{thread.name}</p><ButtonLink href={thread.url} external variant="secondary">開く</ButtonLink></div>)}</div>;
}
