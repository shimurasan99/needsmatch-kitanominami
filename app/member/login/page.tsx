import { LockKeyhole } from "lucide-react";

export default function MemberLoginPage({ searchParams }: { searchParams: { redirect?: string; error?: string } }) {
  const redirectTo = searchParams.redirect?.startsWith("/") ? searchParams.redirect : "/member";
  const isAdminLogin = redirectTo.startsWith("/admin");

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded border border-slate-200 bg-white p-6 shadow-soft">
        <LockKeyhole className="text-forest" size={32} />
        <h1 className="mt-4 text-3xl font-black text-deep">専用ページログイン</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isAdminLogin ? "運営専用ページのパスワードを入力してください。" : "会員専用ページのパスワードを入力してください。"}
        </p>
        {searchParams.error && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            パスワードが違います。
          </p>
        )}
        <form action="/api/login" method="post" className="mt-6 grid gap-5">
          <input type="hidden" name="redirect" value={redirectTo} />
          <label className="block">
            <span className="text-sm font-bold">{isAdminLogin ? "運営専用パスワード" : "会員専用パスワード"}</span>
            <input name="password" type="password" autoComplete="current-password" placeholder="パスワードを入力" className="focus-ring mt-2 w-full rounded border border-slate-200 px-3 py-3" />
          </label>
          <button className="focus-ring rounded bg-forest px-4 py-3 text-sm font-bold text-white hover:bg-green-800">
            ログイン
          </button>
        </form>
      </div>
    </section>
  );
}
