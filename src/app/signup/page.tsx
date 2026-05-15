"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";
import PasswordInput from "@/components/PasswordInput";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const isValidEmail = email.includes("@") && email.length > 5;
  const passwordsMatch = password === confirm && password.length >= 6;
  const canSubmit = isValidEmail && passwordsMatch;

  function humanAuthError(err: any) {
    if (!err) return "Something went wrong. Try again.";
    const msg = (err.message ?? err.error_description ?? JSON.stringify(err))
      .toString()
      .toLowerCase();

    if (msg.includes("already registered") || msg.includes("duplicate") || msg.includes("user already")) {
      return "An account with that email already exists. Try signing in or resend verification.";
    }
    if (msg.includes("invalid") || msg.includes("weak")) {
      return "Please pick a stronger password (6+ chars).";
    }
    return err.message ?? String(err);
  }

  function extractUserId(resp: any) {
    return (
      resp?.user?.id ??
      resp?.data?.user?.id ??
      resp?.session?.user?.id ??
      resp?.data?.session?.user?.id ??
      null
    );
  }

  function setGuestCookie() {
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const cookie = `truemate_guest=1; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = cookie;

    // keep a local copy too, useful for client-side UI later
    localStorage.setItem("truemate_guest", "1");
    localStorage.setItem("truemate_guest_messages", "0");
    localStorage.removeItem("truemate_guest_limit_reached");
  }

  async function handleContinueAsGuest() {
    try {
      setGuestLoading(true);
      setGuestCookie();
      router.push("/home");
    } catch (err) {
      console.error("Guest mode error:", err);
      alert("Could not start guest mode. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  async function handleGoogleSignup() {
    try {
      setLoading(true);

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setLoading(false);
        alert(humanAuthError(error));
      }
    } catch (err: any) {
      setLoading(false);
      alert(humanAuthError(err));
    }
  }

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return alert("Please fix the form before continuing");

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setLoading(false);

      if (error) return alert(humanAuthError(error));

      const userId = extractUserId(data);

      if (userId) {
        const { error: upErr } = await supabase
          .from("users_data")
          .upsert(
            [{ id: userId, email, created_at: new Date().toISOString() }],
            { onConflict: "id" }
          );
        if (upErr) console.warn("users_data upsert error:", upErr);
      } else {
        const { error: upErr } = await supabase
          .from("users_data")
          .upsert(
            [{ email, created_at: new Date().toISOString() }],
            { onConflict: "email" }
          );
        if (upErr) console.warn("users_data fallback upsert by email error:", upErr);
      }

      alert("Account created — check your email to confirm.");
      router.push("/signin");
    } catch (err: any) {
      setLoading(false);
      alert(humanAuthError(err));
    }
  }

  async function resendVerification() {
    if (!email || !isValidEmail) return alert("Enter the email you used to sign up.");
    try {
      setResendLoading(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setResendLoading(false);
      if (error) return alert(humanAuthError(error));
      alert("Verification email resent — check your inbox and spam.");
    } catch (err: any) {
      setResendLoading(false);
      alert(humanAuthError(err));
    }
  }

  return (
    <AuthCard title="Create your account">
      <div className="space-y-3 mb-4">
        <button
          type="button"
          onClick={handleContinueAsGuest}
          disabled={guestLoading || loading || resendLoading}
          className="w-full py-3 rounded border border-gray-300 bg-gray-50 text-black font-medium hover:bg-gray-100 disabled:opacity-60"
        >
          {guestLoading ? "Starting guest mode..." : "Continue as guest"}
        </button>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading || guestLoading}
          className="w-full py-3 rounded border border-gray-300 bg-white text-black font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Connecting..." : "Sign up with Google"}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-xs text-gray-500">or</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      <form className="space-y-4" onSubmit={handleSignUp}>
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
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Create a password (6+ chars)"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Confirm password</span>
          <input
            type="password"
            className="border p-3 rounded w-full mt-1"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        <div className="text-xs text-gray-500">
          Password must be at least 6 characters. Use a mix of letters and numbers for
          better security.
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading || guestLoading}
          className="w-full py-3 rounded bg-green-600 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={resendVerification}
            disabled={resendLoading || guestLoading}
            className="text-sm text-blue-600 underline mt-2"
          >
            {resendLoading ? "Resending..." : "Didn't receive email? Resend verification"}
          </button>
        </div>

        <div className="text-center text-sm">
          Already have an account?{" "}
          <a href="/signin" className="text-blue-600 underline">
            Sign in
          </a>
        </div>
      </form>
    </AuthCard>
  );
}