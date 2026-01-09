// supabase/functions/send-push/index.ts
// PRODUCTION-READY Supabase Edge Function
// Sends push notification to web PWA using Firebase FCM HTTP v1

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- ENV ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!; // could be real newlines or escaped "\n"

// ---------- SUPABASE ----------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- HELPERS ----------
// helper: convert PEM string (with real newlines or "\n") to ArrayBuffer of DER bytes
function pemToArrayBuffer(pem: string): ArrayBuffer {
  // support either real newlines or escaped \n sequences
  const normalized = pem.replace(/\\n/g, "\n");
  // remove header/footer and non-base64 chars (whitespace)
  const b64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!b64) throw new Error("PEM base64 content is empty after stripping headers.");
  // atob -> binary string -> uint8array
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaimSet = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsignedJWT = `${enc(jwtHeader)}.${enc(jwtClaimSet)}`;

  // --- PEM -> ArrayBuffer (DER)
  let keyData: ArrayBuffer;
  try {
    keyData = pemToArrayBuffer(FIREBASE_PRIVATE_KEY);
  } catch (e) {
    console.error("[send-push] pemToArrayBuffer failed:", (e as Error)?.message ?? e);
    throw new Error("Invalid FIREBASE_PRIVATE_KEY format");
  }

  // import the pkcs8 DER key properly
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch (e) {
    console.error("[send-push] importKey failed:", e);
    throw e;
  }

  // sign
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJWT),
  );

  const signedJWT = `${unsignedJWT}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")}`;

  // exchange for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJWT,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("[send-push] token response not JSON:", { status: res.status, bodyText: text });
    throw new Error("Failed to obtain access token (non-JSON response)");
  }
  if (!data.access_token) {
    console.error("[send-push] token response missing access_token:", { status: res.status, body: data });
    throw new Error("Failed to obtain access token");
  }
  return data.access_token as string;
}

async function sendPush(token: string, title: string, body: string, url: string) {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            fcm_options: { link: url },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("FCM error:", err);
  }
}

// ---------- SERVER ----------
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title || !body) {
      return new Response("Missing fields", { status: 400 });
    }

    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("push_token")
      .eq("user_id", user_id);

    if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    await Promise.all(
      (tokens as Array<{ push_token: string }>).map((t) => sendPush(t.push_token, title, body, url || "/chat")),
    );

    return new Response(JSON.stringify({ ok: true, sent: (tokens as any).length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Error", { status: 500 });
  }
});
