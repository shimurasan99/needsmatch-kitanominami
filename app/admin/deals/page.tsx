import { AdminShell } from "@/components/admin/admin-shell";
import { DealResultsManager } from "@/components/admin/deal-results-manager";
import { dealResults, members } from "@/lib/data/mock";

export default function AdminDealsPage() {
  return (
    <AdminShell title="商談成立実績管理">
      <DealResultsManager initialDeals={dealResults} members={members} />
    </AdminShell>
  );
}
