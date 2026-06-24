import Image from "next/image";
import { MemberDirectory } from "@/components/members/member-directory";
import { members } from "@/lib/data/mock";

export default function MembersPage({ searchParams }: { searchParams: { q?: string; major?: string; role?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const major = searchParams.major ?? "";
  const role = searchParams.role ?? "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
        <Image
          src="/images/kitanominami-page-main.jpg"
          alt="ニーズマッチ 北のみなみ支部 メインビジュアル"
          width={1920}
          height={1080}
          priority
          className="aspect-[16/9] w-full object-cover"
        />
      </div>
      <p className="text-sm font-bold text-forest">MEMBERS</p>
      <h1 className="mt-3 text-4xl font-black text-deep">会員紹介</h1>
      <MemberDirectory initialMembers={members} q={q} major={major} role={role} />
    </section>
  );
}
