import { AdminShell } from "@/components/admin/admin-shell";
import { OperationsManager } from "@/components/admin/operations-manager";
import { members, meetings } from "@/lib/data/mock";

export default function OperationsPage() {
  return <AdminShell title="名簿・受講・セミナー管理"><OperationsManager initialMembers={members} initialMeetings={meetings} /></AdminShell>;
}
