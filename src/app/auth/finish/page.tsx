"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    let cancelled = false;

    async function finishGoogleLogin() {
      try {
        setMessage("Finishing login...");

        const code = new URL(window.location.href).searchParams.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("exchangeCodeForSession error:", exchangeError);
          }
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data?.user) throw new Error("No authenticated user found.");

        const user = data.user;
        const now = new Date().toISOString();

        const basePayload = {
          id: user.id,
          email: user.email ?? null,
          updated_at: now,
        };

        // Always save id + email first
        const { error: baseUpsertError } = await supabase
          .from("users_data")
          .upsert([basePayload], { onConflict: "id" });

        if (baseUpsertError) {
          throw baseUpsertError;
        }

        // Try to save name/avatar too if those columns exist
        const name =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.user_metadata?.display_name ??
          user.user_metadata?.preferred_username ??
          user.email?.split("@")[0] ??
          null;

        const avatar_url =
          user.user_metadata?.avatar_url ??
          user.user_metadata?.picture ??
          null;

        const extraPayload: Record<string, any> = { updated_at: now };
        if (name) extraPayload.name = name;
        if (avatar_url) extraPayload.avatar_url = avatar_url;

        const { error: extraUpdateError } = await supabase
          .from("users_data")
          .update(extraPayload)
          .eq("id", user.id);

        if (extraUpdateError) {
          console.warn("Optional name/avatar update skipped or failed:", extraUpdateError);
        }

        if (!cancelled) {
          setMessage("Login successful. Redirecting...");
          router.replace("/home");
        }
      } catch (err) {
        console.error("Auth callback error:", err);

        if (!cancelled) {
          setMessage("Redirecting...");
          router.replace("/home");
        }
      }
    }

    finishGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="rounded-xl border p-6 shadow-sm bg-white max-w-sm w-full text-center">
        <div className="text-lg font-medium">Signing you in</div>
        <div className="text-sm text-gray-600 mt-2">{message}</div>
      </div>
    </div>
  );
}