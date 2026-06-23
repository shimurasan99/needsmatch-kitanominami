import Link from "next/link";
import Image from "next/image";
import { LockKeyhole, Menu } from "lucide-react";

const nav = [
  { href: "/about", label: "支部紹介" },
  { href: "/members", label: "会員紹介" },
  { href: "/entry", label: "参加申し込み" },
  { href: "/join", label: "入会案内" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded bg-white shadow-soft">
            <Image src="/images/kitanominami-logo.jpg" alt="北のみなみ支部ロゴ" width={48} height={48} className="h-full w-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-black text-deep">ニーズマッチ</span>
            <span className="block text-sm font-bold text-forest">北のみなみ支部</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="focus-ring rounded px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/member/login" className="focus-ring hidden items-center gap-2 rounded border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:flex">
            <LockKeyhole size={16} aria-hidden />
            会員専用
          </Link>
          <Link href="/admin" className="focus-ring rounded bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-red-700">
            運営
          </Link>
          <button className="focus-ring rounded border border-slate-200 p-2 md:hidden" aria-label="メニュー">
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
