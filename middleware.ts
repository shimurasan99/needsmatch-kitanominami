import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "nm_private_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/member") || pathname.startsWith("/admin");
  const isLoginPage = pathname === "/member/login";

  if (!isProtected || isLoginPage) return NextResponse.next();

  if (request.cookies.get(AUTH_COOKIE)?.value === "ok") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/member/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/member/:path*", "/admin/:path*"]
};
