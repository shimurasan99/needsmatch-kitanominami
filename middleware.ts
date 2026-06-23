import { NextRequest, NextResponse } from "next/server";

const MEMBER_AUTH_COOKIE = "nm_member_auth";
const ADMIN_AUTH_COOKIE = "nm_admin_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/member") || pathname.startsWith("/admin");
  const isLoginPage = pathname === "/member/login";

  if (!isProtected || isLoginPage) return NextResponse.next();

  const hasMemberAuth = request.cookies.get(MEMBER_AUTH_COOKIE)?.value === "ok";
  const hasAdminAuth = request.cookies.get(ADMIN_AUTH_COOKIE)?.value === "ok";

  if (pathname.startsWith("/admin") && hasAdminAuth) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/member") && (hasMemberAuth || hasAdminAuth)) {
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
