"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { SocialLinks } from "@/components/members/social-links";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import type { Member } from "@/types/domain";

export function MemberDetailClient({ memberId, initialMembers }: { memberId: string; initialMembers: Member[] }) {
  const [member, setMember] = useState<Member | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setMember(undefined);
    setLoadError("");
    void fetchManagedMembers(initialMembers).then((allMembers) => {
      if (!active) return;
      setMember(allMembers.find((item) => item.id === memberId && item.isVisible && item.status === "在籍"));
      setLoaded(true);
    }).catch(() => { if (active) { setLoadError("会員情報を読み込めませんでした。再読み込みしてください。"); setLoaded(true); } });
    return () => { active = false; };
  }, [initialMembers, memberId]);

  if (!member) return <p className="mx-auto max-w-3xl px-4 py-16 text-center font-bold text-slate-600">{loadError || (loaded ? "会員情報が見つかりませんでした。" : "会員情報を読み込んでいます...")}</p>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded border border-slate-200 bg-white p-6 shadow-soft md:grid-cols-[240px_1fr]">
        <Image src={member.profileImageUrl || "/images/member-1.svg"} alt={member.name} width={320} height={320} unoptimized className="aspect-square w-full rounded object-cover" />
        <div>
          <p className="text-sm font-bold text-forest">会員No.{member.memberNo}</p>
          <h1 className="mt-2 text-4xl font-black text-deep">{member.name}</h1>
          <p className="mt-2 text-slate-600">{member.kana}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[member.position, member.industry, member.isTableLeader ? "テーブルリーダー" : ""].filter(Boolean).map((tag) => <span key={tag} className="rounded bg-green-50 px-3 py-1 text-sm font-bold text-forest">{tag}</span>)}
          </div>
          <p className="mt-6 leading-8 text-slate-700">{member.bio}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {member.facebookUrl && <ButtonLink href={member.facebookUrl} external variant="secondary">Facebook</ButtonLink>}
            {member.instagramUrl && <ButtonLink href={member.instagramUrl} external variant="secondary">Instagram</ButtonLink>}
            {member.websiteUrl && <ButtonLink href={member.websiteUrl} external>会社・店舗HP</ButtonLink>}
          </div>
          <div className="mt-4"><SocialLinks member={member} /></div>
        </div>
      </div>
    </section>
  );
}
