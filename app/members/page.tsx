import { MemberDirectory } from "@/components/members/member-directory";
import { members } from "@/lib/data/mock";

export default function MembersPage({ searchParams }: { searchParams: { q?: string; major?: string; role?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const major = searchParams.major ?? "";
  const role = searchParams.role ?? "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">MEMBERS</p>
      <h1 className="mt-3 text-4xl font-black text-deep">会員紹介</h1>
      <MemberDirectory initialMembers={members} q={q} major={major} role={role} />
    </section>
  );
}
