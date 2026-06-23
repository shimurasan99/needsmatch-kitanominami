"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { applyMemberOverrides, readMemberOverrides } from "@/lib/data/member-overrides";
import { SocialLinks } from "@/components/members/social-links";
import type { Member } from "@/types/domain";

export function MemberDirectory({ initialMembers, q, major, role }: { initialMembers: Member[]; q: string; major: string; role: string }) {
  const [members, setMembers] = useState(initialMembers);

  useEffect(() => {
    setMembers(applyMemberOverrides(initialMembers, readMemberOverrides()));
  }, [initialMembers]);

  const visible = useMemo(() => {
    return members.filter((member) => {
      if (!member.isVisible || member.status !== "在籍") return false;
      if (q && !`${member.name} ${member.industry}`.includes(q)) return false;
      if (major && member.majorIndustry !== major) return false;
      if (role && member.position !== role) return false;
      return true;
    });
  }, [members, q, major, role]);

  return (
    <>
      <form className="mt-8 grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_180px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input name="q" defaultValue={q} placeholder="名前・業種で検索" className="focus-ring w-full rounded border border-slate-200 py-3 pl-10 pr-3" />
        </label>
        <select name="major" defaultValue={major} className="focus-ring rounded border border-slate-200 px-3 py-3">
          <option value="">大業種すべて</option>
          <option>サービス業（飲食・美容など）</option>
          <option>保険・建築業</option>
          <option>IT・販売業</option>
          <option>その他</option>
        </select>
        <select name="role" defaultValue={role} className="focus-ring rounded border border-slate-200 px-3 py-3">
          <option value="">役職すべて</option>
          <option>主催</option>
          <option>幹事</option>
          <option>準役員</option>
          <option>一般会員</option>
        </select>
        <button className="focus-ring rounded bg-forest px-5 py-3 font-bold text-white">検索</button>
      </form>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((member) => (
          <article key={member.id} className="rounded border border-slate-200 bg-white p-5 shadow-soft hover:border-forest">
            <Link href={`/members/${member.id}`} className="focus-ring block rounded">
              <div className="flex gap-4">
                <Image src={member.profileImageUrl} alt={member.name} width={96} height={96} className="h-20 w-20 rounded object-cover" />
                <div>
                  <p className="text-xs font-bold text-forest">{member.memberNo}</p>
                  <h2 className="mt-1 text-xl font-black text-deep">{member.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{member.position}</p>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <div><dt className="font-bold text-slate-500">業種</dt><dd>{member.industry}</dd></div>
                <div><dt className="font-bold text-slate-500">大業種</dt><dd>{member.majorIndustry}</dd></div>
              </dl>
            </Link>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <SocialLinks member={member} compact />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
