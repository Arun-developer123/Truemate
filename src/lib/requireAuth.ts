import { supabaseServer } from "@/lib/supabaseServer";

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((part) => {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) return;
    const rawValue = rest.join("=");
    cookies[decodeURIComponent(rawName)] = decodeURIComponent(rawValue || "");
  });

  return cookies;
}

function tryExtractTokenFromCookieValue(value: string): string | null {
  if (!value) return null;

  // plain JWT
  if (value.split(".").length === 3) return value;

  // JSON object / array formats used by some Supabase auth cookie setups
  try {
    const parsed = JSON.parse(value);

    // { access_token: "..." }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (typeof parsed.access_token === "string" && parsed.access_token.split(".").length === 3) {
        return parsed.access_token;
      }
    }

    // ["access_token", "refresh_token", ...]
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].split(".").length === 3) {
      return parsed[0];
    }
  } catch {
    // not JSON, ignore
  }

  return null;
}

function extractAccessTokenFromRequest(req: Request): string | null {
  // 1) Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // 2) Cookies
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);

  const candidateNames = [
    "sb-access-token",
    "supabase-auth-token",
  ];

  for (const name of candidateNames) {
    const value = cookies[name];
    if (!value) continue;

    const token = tryExtractTokenFromCookieValue(value);
    if (token) return token;
  }

  // 3) Search all cookies for a token-like value
  for (const value of Object.values(cookies)) {
    const token = tryExtractTokenFromCookieValue(value);
    if (token) return token;
  }

  return null;
}

export async function requireAuth(req: Request) {
  const token = extractAccessTokenFromRequest(req);

  if (!token) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data?.user) {
    console.warn("Auth validation failed:", error);
    throw new Error("Unauthorized");
  }

  return data.user;
}