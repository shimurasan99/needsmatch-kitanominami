"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import { sortMembersForDirectory } from "@/lib/data/member-sort";
import type { Member } from "@/types/domain";

export function FeaturedMembers({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("会員情報を読み込んでいます...");
  useEffect(() => {
    let active = true;
    void fetchManagedMembers(initialMembers).then((next) => {
      if (!active) return;
      setMembers(sortMembersForDirectory(next.filter((member) => member.isVisible && member.status === "在籍")).slice(0, 4));
      setMessage("");
    }).catch(() => { if (active) setMessage("会員情報を読み込めませんでした。再読み込みしてください。"); });
    return () => { active = false; };
  }, [initialMembers]);

  if (message) return <p className="text-sm text-slate-600">{message}</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {members.map((member) => <Link key={member.id} href={`/members/${member.id}`} className="focus-ring rounded border border-slate-200 bg-snow p-5 shadow-soft hover:bg-white">
      <Image src={member.profileImageUrl || "/images/member-1.svg"} alt={member.name} width={96} height={96} unoptimized className="h-16 w-16 rounded object-cover" />
      <p className="mt-4 font-bold text-deep">{member.name}</p>
      <p className="mt-1 text-sm text-slate-600">{member.industry}</p>
    </Link>)}
  </div>;
}
