import { NextRequest, NextResponse } from "next/server";

// Route guard only: redirects to /login when no auth cookie is present.
// JWT verification and role checks happen in the pages / API routes
// themselves (getSession / requireSession), not here.
export function middleware(req: NextRequest) {
  const token = req.cookies.get("foodflow_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/restaurant/:path*",
    "/delivery/:path*",
    "/admin/:path*",
    "/orders/:path*",
    "/checkout/:path*",
    "/cart/:path*",
    "/profile/:path*",
    "/lab/:path*",
  ],
};
