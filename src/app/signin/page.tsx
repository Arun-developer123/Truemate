'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthCard from '@/components/AuthCard';
import PasswordInput from '@/components/PasswordInput';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = email.trim().length > 5 && password.length >= 6;

  async function handleSignIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isValid) return alert('Please provide a valid email and password (6+ characters)');

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) {
        throw error;
      }

      // Ensure user row exists — pass an array and a string for onConflict to satisfy types
      await supabase.from('users_data').upsert([{ email }], { onConflict: 'email' });

      // Redirect to home (protected route should also verify session)
      router.push('/home');
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || 'Sign in failed');
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
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-center text-sm">
          Don't have an account? <a href="/signup" className="text-blue-600 underline">Create one</a>
        </div>
      </form>
    </AuthCard>
  );
}
