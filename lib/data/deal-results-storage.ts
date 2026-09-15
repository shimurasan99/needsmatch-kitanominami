"use client";

import type { DealResult } from "@/types/domain";
import { fetchSharedState, updateSharedState } from "@/lib/data/shared-state";
import { mergeEditedRecords } from "@/lib/data/merge-edited-records";

export const DEAL_RESULTS_STORAGE_KEY = "nm_deal_results_v2";
const DEAL_RESULTS_UPDATED_EVENT = "nm-deal-results-updated";

export function readDealResults(fallback: DealResult[]) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(DEAL_RESULTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as DealResult[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((deal) => deal.id && deal.fromMemberName && deal.toMemberName);
  } catch {
    return fallback;
  }
}

export function writeDealResults(deals: DealResult[]) {
  try { window.localStorage.setItem(DEAL_RESULTS_STORAGE_KEY, JSON.stringify(deals)); } catch { /* Optional browser cache. */ }
  window.dispatchEvent(new Event(DEAL_RESULTS_UPDATED_EVENT));
}

export async function fetchDealResults(fallback: DealResult[]) {
  const shared = await fetchSharedState<DealResult[]>("deals");
  const next = shared ?? fallback;
  try { window.localStorage.setItem(DEAL_RESULTS_STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional browser cache. */ }
  return next;
}

export async function saveDealResults(deals: DealResult[], baseline: DealResult[]) {
  const next = await updateSharedState<DealResult[]>("deals", (current) => mergeEditedRecords(current ?? baseline, baseline, deals));
  writeDealResults(next);
  return next;
}

export function subscribeDealResults(listener: () => void) {
  window.addEventListener(DEAL_RESULTS_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(DEAL_RESULTS_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
