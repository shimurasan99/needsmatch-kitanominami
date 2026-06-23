import { TableAssignmentView } from "@/components/table-assignment/table-assignment-view";
import { members, participants, pastAssignments } from "@/lib/data/mock";
import { generateTableAssignment } from "@/lib/table-assignment/generator";

export default function MemberTableAssignmentsPage() {
  const result = generateTableAssignment(participants, members, pastAssignments, 200);
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">PUBLISHED</p>
      <h1 className="mt-3 text-3xl font-black text-deep">次回定例会のテーブル割り</h1>
      <div className="mt-6">
        <TableAssignmentView tables={result.tables} score={result.score} warnings={result.warnings} />
      </div>
    </section>
  );
}
