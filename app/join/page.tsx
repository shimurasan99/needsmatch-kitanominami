import { ButtonLink } from "@/components/ui/button-link";

export default function JoinPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">JOIN</p>
      <h1 className="mt-3 text-4xl font-black text-deep">入会・退会について</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Plan title="72時間以内限定" price="入会金無料" lines={["初回ゲスト参加から72時間以内", "月会費3ヶ月分無料", "元会員・再入会の方は対象外"]} highlight />
        <Plan title="72時間以降の特典" price="入会金11,000円" lines={["月会費3ヶ月分無料", "元会員・再入会の方は対象外", "特典申請が必要"]} />
        <Plan title="通常入会" price="合計28,160円" lines={["入会金11,000円", "月会費8,580円 × 2ヶ月分", "一般入会フォームより手続き"]} />
      </div>
      <div className="mt-8 rounded border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-black text-deep">入会後に必要なこと</h2>
        <ul className="mt-4 grid gap-3 text-slate-700">
          <li>研修を受講し、交流会マーケティングについて学びます。</li>
          <li>各支部へ参加し、人脈と紹介の機会を広げます。</li>
          <li>ゲスト参加は1年間で2回まで。退会後は半年間ゲスト参加できません。</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="https://pro.form-mailer.jp/fms/9fc637d4348723" external>一般入会フォームへ</ButtonLink>
          <ButtonLink href="/entry" variant="secondary">新規入会特典について問い合わせる</ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Plan({ title, price, lines, highlight }: { title: string; price: string; lines: string[]; highlight?: boolean }) {
  return (
    <article className={`rounded border p-6 shadow-soft ${highlight ? "border-forest bg-green-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm font-bold text-forest">{title}</p>
      <h2 className="mt-2 text-2xl font-black text-deep">{price}</h2>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </article>
  );
}
