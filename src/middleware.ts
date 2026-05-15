// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const INTRO_SEEN_COOKIE = "truemate_intro_seen";
const INTRO_REQUIRED_COOKIE = "truemate_intro_required";
const LAST_ACTIVE_COOKIE = "truemate_last_active";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isGuestRequest(req: NextRequest) {
  return req.cookies.get("truemate_guest")?.value === "1";
}

function getCookieNumber(req: NextRequest, name: string) {
  const raw = req.cookies.get(name)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function cloneCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

function withRedirect(url: URL, from: NextResponse) {
  const redirectRes = NextResponse.redirect(url);
  cloneCookies(from, redirectRes);
  return redirectRes;
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const guestMode = isGuestRequest(req);

  const introSeen = req.cookies.get(INTRO_SEEN_COOKIE)?.value === "1";
  const introRequired = req.cookies.get(INTRO_REQUIRED_COOKIE)?.value === "1";
  const lastActive = getCookieNumber(req, LAST_ACTIVE_COOKIE);
  const now = Date.now();

  const inactiveTooLong =
    lastActive !== null ? now - lastActive >= THREE_DAYS_MS : true;

  const shouldShowIntro = !introSeen || inactiveTooLong;

  const setIntroRequiredCookies = (target: NextResponse) => {
    target.cookies.set({
      name: INTRO_REQUIRED_COOKIE,
      value: "1",
      path: "/",
      maxAge: 60 * 10,
      sameSite: "lax",
    });
  };

  const clearIntroRequiredCookie = (target: NextResponse) => {
    target.cookies.set({
      name: INTRO_REQUIRED_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  };

  const setLastActiveCookie = (target: NextResponse) => {
    target.cookies.set({
      name: LAST_ACTIVE_COOKIE,
      value: String(now),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  };

  // Guest users can access /home without login
  if (!session && pathname.startsWith("/home")) {
    if (guestMode) {
      return res;
    }
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Intro page should be available only for signed-in users
  if (!session && pathname.startsWith("/intro")) {
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

    // If intro is needed, force it before /home and also when opening signin/signup
    if (shouldShowIntro) {
      if (
        pathname.startsWith("/home") ||
        pathname === "/signin" ||
        pathname === "/signup"
      ) {
        const redirectRes = NextResponse.redirect(new URL("/intro", req.url));
        cloneCookies(res, redirectRes);
        setIntroRequiredCookies(redirectRes);
        return redirectRes;
      }

      if (pathname.startsWith("/intro")) {
        const introRes = NextResponse.next();
        cloneCookies(res, introRes);
        setIntroRequiredCookies(introRes);
        return introRes;
      }
    } else {
      // Intro not needed anymore
      if (pathname.startsWith("/intro")) {
        const redirectRes = NextResponse.redirect(new URL("/home", req.url));
        cloneCookies(res, redirectRes);
        clearIntroRequiredCookie(redirectRes);
        setLastActiveCookie(redirectRes);
        return redirectRes;
      }

      // Logged-in users should not see auth pages
      if (pathname === "/signin" || pathname === "/signup") {
        const redirectRes = NextResponse.redirect(new URL("/home", req.url));
        cloneCookies(res, redirectRes);
        clearIntroRequiredCookie(redirectRes);
        setLastActiveCookie(redirectRes);
        return redirectRes;
      }
    }

    // On normal app visits, keep last active fresh
    if (pathname.startsWith("/home")) {
      setLastActiveCookie(res);
      clearIntroRequiredCookie(res);
    }
  }

  return res;
}

export const config = {
  matcher: ["/home/:path*", "/intro", "/signin", "/signup"],
};