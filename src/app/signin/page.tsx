"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 🔹 Sign Up
  const handleSignUp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    // naya user row insert karo
    await supabase.from("users_data").upsert({ email });
    alert("Account created! Check your email for verification.");
  };

  // 🔹 Sign In
  const handleSignIn = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    // ensure row exist hai
    await supabase.from("users_data").upsert({ email });

    router.push("/home"); // ✅ login success → home page
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Truemate Auth</h1>

        <input
          type="email"
          placeholder="Email"
          className="border p-2 mb-3 w-full rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-2 mb-3 w-full rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="bg-blue-600 text-white w-full py-2 rounded mb-2 hover:bg-blue-700"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <button
          onClick={handleSignUp}
          disabled={loading}
          className="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700"
        >
          {loading ? "Creating..." : "Sign Up"}
        </button>
      </div>
    </div>
  );
}
