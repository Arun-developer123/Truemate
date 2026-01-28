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

  // forgot password UI states
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

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

  function humanAuthError(err: any) {
    if (!err) return "Something went wrong. Try again.";
    const msg = (err.message ?? err.error_description ?? JSON.stringify(err)).toString().toLowerCase();
    if (msg.includes("invalid login") || msg.includes("invalid_credentials") || msg.includes("incorrect")) {
      return "Email or password incorrect.";
    }
    if (msg.includes("confirm") || msg.includes("not confirmed") || msg.includes("verification")) {
      return "Please verify your email — check your inbox and spam.";
    }
    if (msg.includes("user not found") || msg.includes("no user")) {
      return "No account found with that email.";
    }
    return err.message ?? String(err);
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

      if (error) return alert(humanAuthError(error));

      const userId = extractUserId(data);

      if (userId) {
        await ensureUsersDataById(userId, email);
      } else {
        // fallback: upsert by email
        const { error: upErr } = await supabase
          .from("users_data")
          .upsert([{ email, updated_at: new Date().toISOString() }], { onConflict: "email" });
        if (upErr) console.warn("users_data fallback upsert by email error:", upErr);
      }

      router.refresh();
      router.push("/home");

    } catch (err: any) {
      setLoading(false);
      alert(humanAuthError(err));
    }
  }

  // ===== Forgot password: send reset email =====
  async function sendResetEmail(e?: React.FormEvent) {
    e?.preventDefault();
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail || targetEmail.length < 6) {
      return alert("Please provide a valid email to send reset instructions.");
    }

    try {
      setSendingReset(true);
      setResetMessage(null);

      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/update-password`;

      const { data, error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });

      setSendingReset(false);

      if (error) {
        console.error("resetPasswordForEmail error:", error);
        setResetMessage(`Error: ${humanAuthError(error)}`);
      } else {
        setResetMessage("Password reset email sent. Check your inbox (and spam).");
      }
    } catch (err: any) {
      setSendingReset(false);
      console.error("sendResetEmail catch:", err);
      setResetMessage(`Error: ${humanAuthError(err)}`);
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

        <div className="flex items-center justify-between text-sm">
          <div>
            Don't have an account?{" "}
            <a href="/signup" className="text-blue-600 underline">
              Create one
            </a>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setShowForgot((s) => !s);
                setForgotEmail(email || "");
                setResetMessage(null);
              }}
              className="text-sm underline text-blue-600 ml-4"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </form>

      {/* Forgot password inline area */}
      {showForgot && (
        <div className="mt-6 bg-gray-50 border p-4 rounded">
          <h3 className="font-medium mb-2">Reset your password</h3>
          <p className="text-sm mb-3">Enter your email to receive a password reset link.</p>

          <form onSubmit={sendResetEmail} className="space-y-3">
            <input
              type="email"
              className="border p-3 rounded w-full"
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={sendingReset}
                className="py-2 px-4 rounded bg-blue-600 text-white disabled:opacity-60"
              >
                {sendingReset ? "Sending..." : "Send reset email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setResetMessage(null);
                }}
                className="py-2 px-4 rounded border"
              >
                Cancel
              </button>
            </div>
            {resetMessage && (
              <div className="text-sm mt-2">{resetMessage}</div>
            )}
            <div className="text-xs mt-2 text-gray-600">
              After clicking the link in your email you will be redirected to <code>/update-password</code> to set a new password.
            </div>
          </form>
        </div>
      )}
    </AuthCard>
  );
}
