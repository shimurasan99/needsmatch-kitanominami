import { PublishedTableAssignmentSelector } from "@/components/member/published-table-assignment-selector";
import { meetings } from "@/lib/data/mock";

export default function MemberTableAssignmentsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">PUBLISHED</p>
      <h1 className="mt-3 text-3xl font-black text-deep">定例会のテーブル割り</h1>
      <div className="mt-6">
        <PublishedTableAssignmentSelector meetings={meetings} />
      </div>
    </section>
  );
}
