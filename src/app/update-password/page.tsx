"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [userPresent, setUserPresent] = useState<boolean | null>(null);

  useEffect(() => {
    // Try to detect if a session/user is present (Supabase parses url fragment on client init)
    (async () => {
      try {
        // getUser() will check server for a valid session if available
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.warn("getUser error:", error);
          setUserPresent(false);
        } else if (data?.user) {
          setUserPresent(true);
        } else {
          setUserPresent(false);
        }
      } catch (e) {
        console.warn("getUser catch:", e);
        setUserPresent(false);
      }
    })();
  }, []);

  async function handleUpdate(e?: React.FormEvent) {
    e?.preventDefault();
    setMessage(null);

    if (newPass.length < 6) {
      return setMessage("Password must be at least 6 characters.");
    }
    if (newPass !== confirmPass) {
      return setMessage("Passwords do not match.");
    }

    try {
      setLoading(true);
      // This call requires the user to have a session from clicking the reset link in their email.
      const { data, error } = await supabase.auth.updateUser({ password: newPass });
      setLoading(false);

      if (error) {
        console.error("updateUser error:", error);
        setMessage(`Error: ${error.message ?? String(error)}`);
      } else {
        setMessage("Password updated successfully. You can now sign in with the new password.");
      }
    } catch (err: any) {
      setLoading(false);
      console.error("updateUser catch:", err);
      setMessage(`Error: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <AuthCard title="Set a new password">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {userPresent === null && "Checking session..."}
          {userPresent === false && (
            <>
              It looks like there's no active password-recovery session in this browser. Open the password reset link in the same browser/device where you clicked the email, or request another reset from the Sign In page.
            </>
          )}
          {userPresent === true && <>Enter your new password below.</>}
        </p>

        <form onSubmit={handleUpdate} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="border p-3 rounded w-full"
            aria-label="New password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            className="border p-3 rounded w-full"
            aria-label="Confirm password"
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || userPresent === false}
              className="py-2 px-4 rounded bg-blue-600 text-white disabled:opacity-60"
            >
              {loading ? "Updating..." : "Set new password"}
            </button>

            <a href="/signin" className="text-sm underline">Back to sign in</a>
          </div>

          {message && <div className="text-sm mt-2">{message}</div>}
        </form>
      </div>
    </AuthCard>
  );
}
