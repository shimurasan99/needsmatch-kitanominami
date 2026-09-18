import Link from "next/link";
import type { Metadata } from "next";
import { PublicTableAssignment } from "@/components/table-assignment/public-table-assignment";

export const metadata: Metadata = {
  title: "定例会のテーブル割り | ニーズマッチ 北のみなみ支部",
  robots: { index: false, follow: false }
};

export default async function PublicTableAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/" className="text-sm font-bold text-forest hover:underline">← トップページへ戻る</Link>
      <p className="mt-8 text-sm font-bold text-forest">TABLE ASSIGNMENT</p>
      <h1 className="mt-2 text-3xl font-black text-deep">定例会のテーブル割り</h1>
      <p className="mt-3 text-sm text-slate-600">運営が公開したテーブル割りを、ログインせずに確認できます。</p>
      <PublicTableAssignment key={id} meetingId={id} />
    </section>
  );
}
