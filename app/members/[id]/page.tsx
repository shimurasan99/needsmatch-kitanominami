import Image from "next/image";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { SocialLinks } from "@/components/members/social-links";
import { members } from "@/lib/data/mock";

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  const member = members.find((item) => item.id === params.id && item.isVisible);
  if (!member) notFound();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded border border-slate-200 bg-white p-6 shadow-soft md:grid-cols-[240px_1fr]">
        <Image src={member.profileImageUrl} alt={member.name} width={320} height={320} className="aspect-square w-full rounded object-cover" />
        <div>
          <p className="text-sm font-bold text-forest">{member.memberNo}</p>
          <h1 className="mt-2 text-4xl font-black text-deep">{member.name}</h1>
          <p className="mt-2 text-slate-600">{member.kana}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[member.position, member.industry, member.isTableLeader ? "テーブルリーダー" : ""].filter(Boolean).map((tag) => (
              <span key={tag} className="rounded bg-green-50 px-3 py-1 text-sm font-bold text-forest">{tag}</span>
            ))}
          </div>
          <p className="mt-6 leading-8 text-slate-700">{member.bio}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={member.facebookUrl} external variant="secondary">Facebook</ButtonLink>
            <ButtonLink href={member.instagramUrl} external variant="secondary">Instagram</ButtonLink>
            <ButtonLink href={member.websiteUrl} external>会社・店舗HP</ButtonLink>
          </div>
          <div className="mt-4">
            <SocialLinks member={member} />
          </div>
        </div>
      </div>
    </section>
  );
}
