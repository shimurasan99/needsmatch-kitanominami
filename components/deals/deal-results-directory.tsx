"use client";

import Image from "next/image";
import { ArrowRight, Banknote, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readDealResults, subscribeDealResults } from "@/lib/data/deal-results-storage";
import type { DealIndustry, DealResult } from "@/types/domain";

const dealIndustries: DealIndustry[] = ["美容", "商材", "イベント", "IT", "販売", "飲食", "保険", "不動産", "営業", "研修"];
type SortKey = "newest" | "oldest" | "sales-desc" | "sales-asc";

function formatMonth(month: string) {
  const [year, value] = month.split("-");
  if (!year || !value) return month;
  return `${year}年${Number(value)}月`;
}

function formatSales(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

export function DealResultsDirectory({ initialDeals }: { initialDeals: DealResult[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [industry, setIndustry] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  useEffect(() => {
    setDeals(readDealResults(initialDeals));
    return subscribeDealResults(() => setDeals(readDealResults(initialDeals)));
  }, [initialDeals]);

  const visibleDeals = useMemo(() => {
    const filtered = industry ? deals.filter((deal) => deal.industry === industry) : deals;
    return [...filtered].sort((a, b) => {
      if (sortKey === "newest") return b.month.localeCompare(a.month);
      if (sortKey === "oldest") return a.month.localeCompare(b.month);
      if (sortKey === "sales-desc") return b.sales - a.sales;
      return a.sales - b.sales;
    });
  }, [deals, industry, sortKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 shadow-soft">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-600">業種</span>
          <select value={industry} onChange={(event) => setIndustry(event.target.value)} className="focus-ring rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-deep">
            <option value="">すべて</option>
            {dealIndustries.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-600">並べ替え</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="focus-ring rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-deep">
            <option value="newest">日付が近い順</option>
            <option value="oldest">日付が古い順</option>
            <option value="sales-desc">売上が高い順</option>
            <option value="sales-asc">売上が低い順</option>
          </select>
        </label>
        <p className="text-sm font-bold text-slate-500">{visibleDeals.length}件表示</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {visibleDeals.map((deal) => (
          <article key={deal.id} className="overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
            <div className="relative bg-snow">
              <Image src={deal.imageUrl} alt={`${deal.fromMemberName}から${deal.toMemberName}への商談成立実績`} width={900} height={560} className="aspect-[16/10] w-full object-cover" unoptimized={deal.imageUrl.startsWith("data:")} />
              <div className="absolute left-4 top-4 rounded bg-accent px-3 py-1 text-xs font-black text-white">{deal.industry}</div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-lg font-black text-deep">
                <span>{deal.fromMemberName}さん</span>
                <ArrowRight size={18} className="text-forest" />
                <span>{deal.toMemberName}さん</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
                <span className="inline-flex items-center gap-1"><CalendarDays size={16} />{formatMonth(deal.month)}</span>
                <span className="inline-flex items-center gap-1"><Banknote size={16} />{formatSales(deal.sales)}</span>
              </div>
              <p className="mt-4 leading-7 text-slate-700">{deal.description}</p>
            </div>
          </article>
        ))}
      </div>

      {visibleDeals.length === 0 && (
        <p className="rounded border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-soft">該当する商談成立実績はありません。</p>
      )}
    </div>
  );
}
