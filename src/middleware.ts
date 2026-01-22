// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // 🔒 protect home
  if (!session && pathname.startsWith("/home")) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // 🔁 logged-in user should not access auth pages
  if (session && (pathname === "/signin" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/home/:path*", "/signin", "/signup"],
};
