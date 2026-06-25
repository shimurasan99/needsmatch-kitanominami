"use client";

import Image from "next/image";
import { Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { readDealResults, writeDealResults } from "@/lib/data/deal-results-storage";
import type { DealIndustry, DealResult, Member } from "@/types/domain";

const dealIndustries: DealIndustry[] = ["美容", "商材", "イベント", "IT", "販売", "飲食", "保険", "不動産", "営業", "研修"];

export function DealResultsManager({ initialDeals, members }: { initialDeals: DealResult[]; members: Member[] }) {
  const [deals, setDeals] = useState<DealResult[]>(initialDeals);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDeals(readDealResults(initialDeals));
  }, [initialDeals]);

  function addDeal() {
    setSaved(false);
    setDeals((current) => [
      {
        id: `deal-${Date.now()}`,
        fromMemberName: members[0]?.name ?? "",
        toMemberName: members[1]?.name ?? "",
        month: new Date().toISOString().slice(0, 7),
        industry: "IT",
        description: "",
        sales: 0,
        imageUrl: "/images/kitanominami-page-main.jpg"
      },
      ...current
    ]);
  }

  function updateDeal(id: string, values: Partial<DealResult>) {
    setSaved(false);
    setDeals((current) => current.map((deal) => (deal.id === id ? { ...deal, ...values } : deal)));
  }

  function removeDeal(id: string) {
    setSaved(false);
    setDeals((current) => current.filter((deal) => deal.id !== id));
  }

  function saveDeals() {
    writeDealResults(deals);
    setSaved(true);
  }

  function resetDeals() {
    setDeals(initialDeals);
    writeDealResults(initialDeals);
    setSaved(true);
  }

  async function uploadImage(id: string, file: File | undefined) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateDeal(id, { imageUrl: dataUrl });
  }

  return (
    <div className="space-y-5">
      <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-forest">BUSINESS RESULTS</p>
            <h2 className="mt-1 text-2xl font-black text-deep">商談成立実績の管理</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addDeal} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-deep hover:bg-snow">
              <Plus size={16} />
              新規追加
            </button>
            <button type="button" onClick={saveDeals} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-deep">
              <Save size={16} />
              保存
            </button>
          </div>
        </div>
        {saved && <p className="mt-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-forest">保存しました。商談成立実績ページへ反映されます。</p>}
      </div>

      <div className="grid gap-4">
        {deals.map((deal) => (
          <article key={deal.id} className="grid gap-4 rounded border border-slate-200 bg-white p-4 shadow-soft lg:grid-cols-[300px_1fr]">
            <div>
              <div className="overflow-hidden rounded border border-slate-200 bg-snow">
                <Image src={deal.imageUrl} alt="商談成立実績の写真" width={600} height={420} className="aspect-[4/3] w-full object-cover" unoptimized={deal.imageUrl.startsWith("data:")} />
              </div>
              <label className="focus-ring mt-3 flex cursor-pointer items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-deep hover:bg-snow">
                <Upload size={16} />
                写真をアップロード
                <input type="file" accept="image/*" onChange={(event) => uploadImage(deal.id, event.target.files?.[0])} className="sr-only" />
              </label>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-deep">商談実績</p>
                <button type="button" onClick={() => removeDeal(deal.id)} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm font-bold text-accent hover:bg-red-50">
                  <Trash2 size={15} />
                  削除
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MemberSelect label="紹介元会員" value={deal.fromMemberName} members={members} onChange={(value) => updateDeal(deal.id, { fromMemberName: value })} />
                <MemberSelect label="紹介先会員" value={deal.toMemberName} members={members} onChange={(value) => updateDeal(deal.id, { toMemberName: value })} />
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">年月</span>
                  <input type="month" value={deal.month} onChange={(event) => updateDeal(deal.id, { month: event.target.value })} className="focus-ring rounded border border-slate-200 px-3 py-3" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">業種</span>
                  <select value={deal.industry} onChange={(event) => updateDeal(deal.id, { industry: event.target.value as DealIndustry })} className="focus-ring rounded border border-slate-200 bg-white px-3 py-3">
                    {dealIndustries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">売上</span>
                  <input type="number" min="0" value={deal.sales} onChange={(event) => updateDeal(deal.id, { sales: Number(event.target.value) })} className="focus-ring rounded border border-slate-200 px-3 py-3" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">写真URL</span>
                  <input value={deal.imageUrl} onChange={(event) => updateDeal(deal.id, { imageUrl: event.target.value })} className="focus-ring rounded border border-slate-200 px-3 py-3" />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">ビジネス内容（200文字以内）</span>
                <textarea
                  value={deal.description}
                  maxLength={200}
                  onChange={(event) => updateDeal(deal.id, { description: event.target.value.slice(0, 200) })}
                  rows={4}
                  className="focus-ring rounded border border-slate-200 px-3 py-3"
                />
                <span className="text-right text-xs font-bold text-slate-500">{deal.description.length}/200</span>
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveDeals} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white hover:bg-deep">
          <Save size={17} />
          商談実績を保存
        </button>
        <button type="button" onClick={resetDeals} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-deep hover:bg-snow">
          <RotateCcw size={17} />
          初期状態に戻す
        </button>
      </div>
    </div>
  );
}

function MemberSelect({ label, value, members, onChange }: { label: string; value: string; members: Member[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring rounded border border-slate-200 bg-white px-3 py-3">
        {members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
      </select>
    </label>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
