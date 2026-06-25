import Link from "next/link";

const adminLinks = [
  { href: "/admin/members", label: "会員管理" },
  { href: "/admin/meetings", label: "月例会管理" },
  { href: "/admin/deals", label: "商談成立実績" },
  { href: "/admin/gallery", label: "ギャラリー管理" },
  { href: "/admin/threads", label: "スレッド管理" }
];

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
      <aside className="rounded border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-forest">運営専用</p>
        <nav className="grid gap-1">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="focus-ring rounded px-3 py-2 text-sm font-semibold hover:bg-slate-100">
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <h1 className="text-3xl font-black text-deep">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
