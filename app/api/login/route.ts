import { NextResponse } from "next/server";

const MEMBER_AUTH_COOKIE = "nm_member_auth";
const ADMIN_AUTH_COOKIE = "nm_admin_auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirect = safeRedirect(String(formData.get("redirect") ?? "/member"));
  const isAdminLogin = redirect.startsWith("/admin");
  const expectedPassword = isAdminLogin
    ? process.env.ADMIN_SHARED_PASSWORD || "kita1118"
    : process.env.MEMBER_SHARED_PASSWORD || "kita2026";

  if (password !== expectedPassword) {
    const url = new URL("/member/login", request.url);
    url.searchParams.set("redirect", redirect);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(redirect, request.url), { status: 303 });
  response.cookies.set(isAdminLogin ? ADMIN_AUTH_COOKIE : MEMBER_AUTH_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

function safeRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/member";
  return value;
}
