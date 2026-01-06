// src/app/(auth)/signin/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";
import PasswordInput from "@/components/PasswordInput";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = email.trim().length > 5 && password.length >= 6;

  function extractUserId(resp: any) {
    return (
      resp?.user?.id ??
      resp?.data?.user?.id ??
      resp?.session?.user?.id ??
      resp?.data?.session?.user?.id ??
      null
    );
  }

  async function ensureUsersDataById(userId: string | null, emailFallback?: string) {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from("users_data")
        .upsert(
          [{ id: userId, email: emailFallback ?? null, updated_at: new Date().toISOString() }],
          { onConflict: "id" }
        );
      if (error) console.warn("ensureUsersDataById upsert error:", error);
    } catch (e) {
      console.warn("ensureUsersDataById error:", e);
    }
  }

  async function handleSignIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isValid) return alert("Please provide a valid email and password (6+ characters)");

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) throw error;

      // Try to extract user id from response shapes
      const userId = extractUserId(data);

      if (userId) {
        // ensure users_data row exists with auth user id
        await ensureUsersDataById(userId, email);
      } else {
        // fallback: ensure row exists by email (will be reconciled by auth listener later)
        const { error: upErr } = await supabase
          .from("users_data")
          .upsert([{ email, updated_at: new Date().toISOString() }], { onConflict: "email" });
        if (upErr) console.warn("users_data fallback upsert by email error:", upErr);
      }

      // Redirect to home (protected route should also verify session)
      router.push("/home");
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || "Sign in failed");
    }
  }

  return (
    <AuthCard title="Welcome back — Sign in">
      <form className="space-y-4" onSubmit={handleSignIn}>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            className="border p-3 rounded w-full mt-1"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <PasswordInput value={password} onChange={setPassword} placeholder="Your strong password" />
        </label>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full py-3 rounded bg-blue-600 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="text-center text-sm">
          Don't have an account?{" "}
          <a href="/signup" className="text-blue-600 underline">
            Create one
          </a>
        </div>
      </form>
    </AuthCard>
  );
}
