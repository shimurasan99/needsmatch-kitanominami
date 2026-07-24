"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MemberEditForm } from "@/components/admin/member-edit-form";
import { members } from "@/lib/data/mock";
import { applyMemberOverrides, readMemberOverrides } from "@/lib/data/member-overrides";
import type { Member } from "@/types/domain";

export default function AdminMemberEditPage({ params }: { params: { id: string } }) {
  const [member, setMember] = useState<Member | undefined>(() => members.find((item) => item.id === params.id));
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedMembers = applyMemberOverrides(members, readMemberOverrides());
    setMember(savedMembers.find((item) => item.id === params.id));
    setIsLoaded(true);
  }, [params.id]);

  return (
    <AdminShell title="会員情報の編集">
      {!isLoaded ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">会員情報を読み込んでいます...</div>
      ) : member ? (
        <MemberEditForm member={member} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="mb-4 text-slate-700">会員情報が見つかりませんでした。</p>
          <Link href="/admin/members" className="font-bold text-primary hover:underline">
            会員管理へ戻る
          </Link>
        </div>
      )}
    </AdminShell>
  );
}
