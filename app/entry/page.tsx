import { ButtonLink } from "@/components/ui/button-link";

export default function EntryPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-forest">ENTRY</p>
      <h1 className="mt-3 text-4xl font-black text-deep">定例会参加申し込み</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-deep">初めて参加される方へ</h2>
          <div className="mt-5 grid gap-4 leading-8 text-slate-700">
            <p>ニーズマッチは全国に支部があるビジネス交流会です。月例会では4〜6人のグループでテーブル商談を行い、1人1分〜2分30秒ほどのPRと質疑・商談の時間を設けます。</p>
            <p>ゲスト参加は直近1年間で2回まで、参加費は3,000円です。ネットワークビジネス、MLM、金融商品の案内などは禁止事項があります。</p>
          </div>
          <ol className="mt-6 grid gap-3">
            {["参加申込", "役員より連絡", "Facebookメッセンジャースレッドへ招待", "1on1シート提出", "月例会当日参加"].map((step, index) => (
              <li key={step} className="flex gap-3 rounded bg-snow p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-forest text-sm font-bold text-white">{index + 1}</span>
                <span className="font-semibold">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            持ち物は名刺、筆記用具、PRに必要な資料です。キャンセルは48時間前までに参加支部の役員または紹介者へ連絡してください。
          </div>
        </article>
        <aside className="rounded border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-black text-deep">申し込みリンク</h2>
          <div className="mt-6 grid gap-3">
            <ButtonLink href="https://docs.google.com/forms/d/e/1FAIpQLSfqDcLe-KUF0-XvE74QnfXeEl5dmux8DhRtCmz7a4oY_yx0jQ/viewform?fbclid=IwAR3WXWwXkm5T8SAHRFtY5JhhQJJxsSfwEMLPxMj0oJzBMhoa5FlOSo65SX4" external>
              他支部からの参加申し込み
            </ButtonLink>
            <ButtonLink href="https://nm2014.jp/guest/" external variant="secondary">ゲスト参加申し込み</ButtonLink>
          </div>
        </aside>
      </div>
    </section>
  );
}
