import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, isSignedInRequest } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/member") || pathname.startsWith("/admin");
  const isLoginPage = pathname === "/member/login";

  if (!isProtected || isLoginPage) return NextResponse.next();

  if (pathname.startsWith("/admin") && await isAdminRequest(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/member") && await isSignedInRequest(request)) {
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
