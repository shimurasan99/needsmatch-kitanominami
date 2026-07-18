import { ButtonLink } from "@/components/ui/button-link";

export default function MemberPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">MEMBER</p>
      <h1 className="mt-3 text-4xl font-black text-deep">会員専用ページ</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Card title="定例会出欠" body="開催日程を選んで、参加・欠席・未定を回答できます。">
          <ButtonLink href="/member/attendance">出欠を回答する</ButtonLink>
        </Card>
        <Card title="メッセンジャースレッド" body="連絡用スレッドと追加スレッドを確認できます。">
          <ButtonLink href="/member/threads" variant="secondary">スレッド一覧</ButtonLink>
        </Card>
        <Card title="テーブル割り" body="公開中の次回定例会と過去分を確認できます。">
          <ButtonLink href="/member/table-assignments" variant="secondary">テーブル割りを見る</ButtonLink>
        </Card>
      </div>
    </section>
  );
}

function Card({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-6 shadow-soft">
      <h2 className="text-xl font-black text-deep">{title}</h2>
      <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{body}</p>
      <div className="mt-5">{children}</div>
    </article>
  );
}
