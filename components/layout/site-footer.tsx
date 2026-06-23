import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <p className="text-lg font-bold text-deep">ニーズマッチ 北のみなみ支部</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            北海道で、人とビジネスがつながる場所。札幌を拠点に、月に一度の対面式ビジネス交流会を開催しています。
          </p>
        </div>
        <div>
          <p className="font-semibold text-deep">公開ページ</p>
          <div className="mt-3 grid gap-2 text-sm">
            <Link href="/about">支部紹介</Link>
            <Link href="/members">会員紹介</Link>
            <Link href="/entry">参加申し込み</Link>
            <Link href="/join">入会案内</Link>
          </div>
        </div>
        <div>
          <p className="font-semibold text-deep">専用ページ</p>
          <div className="mt-3 grid gap-2 text-sm">
            <Link href="/member/login">会員専用</Link>
            <Link href="/admin">運営専用</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
