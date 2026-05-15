// src/app/api/presence/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Production-ready presence endpoint.
 *
 * - Requires header: x-presence-secret: <your-shared-secret>
 * - Accepts JSON POST or sendBeacon-style text/plain POST containing JSON.
 * - Upserts into `user_presence` table using SUPABASE_SERVICE_ROLE_KEY.
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - PRESENCE_API_SECRET   (a shared secret between your app/server and this endpoint)
 *
 * Recommended DB schema (if not present):
 * create table if not exists public.user_presence (
 *   user_id uuid primary key,
 *   is_online boolean not null,
 *   last_active_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * Note: For rate-limiting / abuse protection in production, front this with a gateway
 * that can enforce quotas (Cloudflare, API gateway, or Redis-backed limiter).
 */

// --- sanity-check required envs at module init ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRESENCE_API_SECRET = process.env.PRESENCE_API_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // In production you'd fail fast in CI/deploy; here we log for visibility.
  console.error(
    "Missing Supabase env vars. NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );
}

if (!PRESENCE_API_SECRET) {
  console.warn(
    "PRESENCE_API_SECRET is not set. This endpoint will reject requests without the header. Set PRESENCE_API_SECRET for production."
  );
}

// Create a single Supabase service-role client for server-side use.
// Note: keep this at module scope so it is reused between invocations.
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "truemate-presence-service" } },
});

/** Basic validator for ISO timestamp strings. */
function isValidIsoDatetime(s: unknown) {
  if (typeof s !== "string") return false;
  const n = Date.parse(s);
  return !Number.isNaN(n);
}

/** Normalize incoming user id (trim). Adjust if you expect different format. */
function normalizeUserId(uid: unknown) {
  if (typeof uid !== "string") return null;
  const t = uid.trim();
  return t.length > 0 ? t : null;
}

/** Build a JSON response with CORS headers (if you want permissive CORS) */
function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      // Adjust CORS in production to a specific origin instead of "*"
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
      "Access-Control-Allow-Headers": "Content-Type, x-presence-secret",
    },
  });
}

/** Health / quick read GET */
export async function GET(req: NextRequest) {
  return jsonResponse({ ok: true, message: "Presence endpoint healthy" });
}

/** Allow preflight (useful if browser uses fetch) */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
      "Access-Control-Allow-Headers": "Content-Type, x-presence-secret",
    },
  });
}

/** Support HEAD for sendBeacon or probes */
export async function HEAD() {
  return new Response(null, { status: 204 });
}

/**
 * Main POST handler.
 * Expects body JSON shape:
 * { user_id: string, is_online: boolean, last_active_at?: string (ISO timestamp) }
 */
export async function POST(req: NextRequest) {
  try {
    // 1) Auth: require presence secret header
    const incomingSecret = req.headers.get("x-presence-secret") || "";
    if (!PRESENCE_API_SECRET || incomingSecret !== PRESENCE_API_SECRET) {
      console.warn("Presence auth failed (missing or invalid secret).");
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    // 2) Accept JSON or text/plain (sendBeacon)
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let payloadRaw: any = null;

    if (contentType.includes("application/json")) {
      payloadRaw = await req.json().catch((e) => {
        console.warn("Invalid JSON body:", e);
        return null;
      });
    } else {
      // sendBeacon commonly sends text/plain body containing JSON
      const text = await req.text().catch((e) => {
        console.warn("Failed to read text body:", e);
        return null;
      });
      if (text) {
        try {
          payloadRaw = JSON.parse(text);
        } catch (e) {
          // try forgiving parse: some sendBeacon clients may send 'key=value' — not expected here
          console.warn("Failed to parse text body as JSON:", e);
          payloadRaw = null;
        }
      }
    }

    if (!payloadRaw) {
      return jsonResponse({ ok: false, error: "Invalid or empty body" }, 400);
    }

    // 3) Validate & normalize fields
    const user_id = normalizeUserId(payloadRaw.user_id);
    const is_online = payloadRaw.is_online;
    const last_active_at_raw = payloadRaw.last_active_at;

    if (!user_id || typeof is_online !== "boolean") {
      return jsonResponse(
        { ok: false, error: "Invalid payload: user_id (string) and is_online (boolean) required" },
        400
      );
    }

    let last_active_at: string;
    if (last_active_at_raw) {
      if (!isValidIsoDatetime(last_active_at_raw)) {
        return jsonResponse({ ok: false, error: "Invalid last_active_at: must be ISO timestamp" }, 400);
      }
      last_active_at = new Date(last_active_at_raw).toISOString();
    } else {
      last_active_at = new Date().toISOString();
    }

    // Optional: small rate-limiting heuristic (best-effort, in-process; not reliable in multi-instance)
    // If you need strict rate-limiting use a centralized store (Redis) or API gateway.
    // Example skipped here for reliability reasons in serverless environments.

    // 4) Upsert into Supabase using service role
    // Use onConflict: 'user_id' so it overwrites existing row for same user_id
    const upsertPayload = {
      user_id,
      is_online,
      last_active_at,
      updated_at: new Date().toISOString(),
    };

    // Using returning select after upsert to get updated row representation
    // .upsert supports returning('representation') in some setups — if your client supports it, you can add.
    const { data, error } = await supabase
      .from("user_presence")
      .upsert(upsertPayload, { onConflict: "user_id" })
      .select()
      .limit(1);

    if (error) {
      console.error("Supabase upsert error:", error);
      return jsonResponse({ ok: false, error: "DB error" }, 500);
    }

    const returnedRow = Array.isArray(data) && data.length > 0 ? data[0] : null;

    // Successful response
    return jsonResponse({
      ok: true,
      message: "Presence updated",
      updated: returnedRow ?? upsertPayload,
    });
  } catch (err) {
    console.error("Presence endpoint unexpected error:", err);
    return jsonResponse({ ok: false, error: "Server error" }, 500);
  }
}
