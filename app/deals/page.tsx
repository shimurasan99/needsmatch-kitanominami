import { DealResultsDirectory } from "@/components/deals/deal-results-directory";
import { dealResults } from "@/lib/data/mock";

export default function DealsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">BUSINESS RESULTS</p>
      <h1 className="mt-3 text-4xl font-black text-deep">商談成立実績</h1>
      <p className="mt-5 max-w-3xl leading-8 text-slate-700">
        北のみなみ支部で生まれた会員同士の商談成立事例です。業種や売上、時期から実績を確認できます。
      </p>
      <div className="mt-8">
        <DealResultsDirectory initialDeals={dealResults} />
      </div>
    </section>
  );
}
