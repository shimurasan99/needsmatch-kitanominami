"use client";

import Link from "next/link";
import Image from "next/image";
import { LockKeyhole, Menu, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/about", label: "支部紹介" },
  { href: "/members", label: "会員紹介" },
  { href: "/deals", label: "商談成立実績" },
  { href: "/entry", label: "参加申し込み" },
  { href: "/join", label: "入会案内" }
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded bg-white shadow-soft sm:h-12 sm:w-12">
            <Image src="/images/kitanominami-logo.jpg" alt="北のみなみ支部ロゴ" width={48} height={48} className="h-full w-full object-cover" />
          </span>
          <span className="hidden leading-tight min-[360px]:block">
            <span className="block text-sm font-black text-deep sm:text-base">ニーズマッチ</span>
            <span className="block text-xs font-bold text-forest sm:text-sm">北のみなみ支部</span>
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
          <Link href="/member/login" className="focus-ring inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm">
            <LockKeyhole size={15} aria-hidden />
            会員専用
          </Link>
          <Link href="/admin" className="focus-ring rounded bg-accent px-3 py-2 text-xs font-bold text-white shadow-soft hover:bg-red-700 sm:px-4 sm:py-2.5 sm:text-sm">
            運営
          </Link>
          <button
            className="focus-ring rounded border border-slate-200 p-2 md:hidden"
            aria-label={isOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <nav className="border-t border-slate-200 bg-white px-3 py-3 shadow-soft md:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="focus-ring rounded px-3 py-3 text-sm font-bold text-deep hover:bg-snow"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
