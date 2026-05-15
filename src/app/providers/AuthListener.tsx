"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthListener() {
  useEffect(() => {
    let mounted = true;

    async function ensureUserRow(userId: string | null, email?: string) {
      if (!userId) return;
      try {
        await supabase.from("users_data").upsert(
          [{ id: userId, email: email ?? null, updated_at: new Date().toISOString() }],
          { onConflict: "id" }
        );
      } catch (e) {
        console.warn("AuthListener upsert users_data failed:", e);
      }
    }

    // check current session on mount
    supabase.auth.getSession().then(({ data }) => {
      const user = (data as any)?.session?.user ?? (data as any)?.user ?? null;
      if (user) ensureUserRow(user.id, user.email);
    });

    // subscribe to auth changes (sign in/out)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = (session as any)?.user ?? null;
      if (user && mounted) {
        await ensureUserRow(user.id, user.email);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return null;
}
