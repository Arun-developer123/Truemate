// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isGuestRequest(req: NextRequest) {
  return req.cookies.get("truemate_guest")?.value === "1";
}

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

  const { data: { session } } = await supabase.auth.getSession();
  const pathname = req.nextUrl.pathname;
  const guestMode = isGuestRequest(req);

  // Guest users can access /home without login
  if (!session && pathname.startsWith("/home")) {
    if (guestMode) {
      return res;
    }
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Logged-in users → verify DB user exists
  if (session) {
    const email = session.user.email;

    const { data: userRow } = await supabase
      .from("users_data")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Auth user exists but app user missing
    if (!userRow) {
      const redirectUrl = new URL("/signup", req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Logged-in users should not see auth pages
    if (pathname === "/signin" || pathname === "/signup") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/home/:path*", "/signin", "/signup"],
};