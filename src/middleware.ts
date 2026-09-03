import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session-token";

export const SIGN_IN_PATH = "/internal/sign-in";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith(SIGN_IN_PATH)) {
    if (session) return NextResponse.redirect(new URL("/internal/kyc", request.url));
    return NextResponse.next();
  }

  if (!session) {
    const signIn = new URL(SIGN_IN_PATH, request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    const response = NextResponse.redirect(signIn);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*"],
};
