import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { MemberEditForm } from "@/components/admin/member-edit-form";
import { members } from "@/lib/data/mock";

export default function AdminMemberEditPage({ params }: { params: { id: string } }) {
  const member = members.find((item) => item.id === params.id);
  if (!member) notFound();

  return (
    <AdminShell title="会員情報の編集">
      <MemberEditForm member={member} />
    </AdminShell>
  );
}
