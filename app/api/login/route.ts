import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, MEMBER_AUTH_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "ログイン情報を確認してください。" }, { status: 400 }); }
  const password = String(formData.get("password") ?? "");
  const redirect = safeRedirect(String(formData.get("redirect") ?? "/member"));
  const redirectPath = new URL(redirect, request.url).pathname;
  const isAdminLogin = redirectPath === "/admin" || redirectPath.startsWith("/admin/");
  const expectedPassword = isAdminLogin
    ? process.env.ADMIN_SHARED_PASSWORD || "kita1118"
    : process.env.MEMBER_PAGE_PASSWORD || "kita2026";

  if (password !== expectedPassword) {
    const url = new URL("/member/login", request.url);
    url.searchParams.set("redirect", redirect);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  let token: string;
  try { token = await createSessionToken(isAdminLogin ? "admin" : "member"); } catch {
    return NextResponse.json({ error: "ログインの設定が完了していません。運営にお問い合わせください。" }, { status: 503 });
  }
  const response = NextResponse.redirect(new URL(redirect, request.url), { status: 303 });
  response.cookies.set(isAdminLogin ? ADMIN_AUTH_COOKIE : MEMBER_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  return response;
}

function safeRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/member";
  return value;
}
