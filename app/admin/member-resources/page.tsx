import { AdminShell } from "@/components/admin/admin-shell";
import { MemberResources } from "@/components/admin/member-resources";
import { members } from "@/lib/data/mock";
export default function Page() { return <AdminShell title="会員の入会順・1on1シート保管"><MemberResources initialMembers={members} /></AdminShell>; }
