import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Ensure auth cookies work on the uncommon dev port
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
