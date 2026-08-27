"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchSharedState } from "@/lib/data/shared-state";
import type { MessengerThread } from "@/components/admin/thread-manager";

export function ThreadDirectory({ initialThreads }: { initialThreads: MessengerThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  useEffect(() => { void fetchSharedState<MessengerThread[]>("threads").then((value) => value && setThreads(value)).catch(() => undefined); }, []);
  return <div className="mt-6 grid gap-3">{threads.map((thread) => <div key={thread.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4"><p className="font-bold text-deep">{thread.name}</p><ButtonLink href={thread.url} external variant="secondary">開く</ButtonLink></div>)}</div>;
}
