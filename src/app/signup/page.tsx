'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthCard from '@/components/AuthCard';
import PasswordInput from '@/components/PasswordInput';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = email.includes('@') && email.length > 5;
  const passwordsMatch = password === confirm && password.length >= 6;
  const canSubmit = isValidEmail && passwordsMatch;

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return alert('Please fix the form before continuing');

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setLoading(false);

      if (error) throw error;

      // Insert / ensure user row exists — use array + string onConflict
      await supabase.from('users_data').upsert([{ email }], { onConflict: 'email' });

      alert('Account created — check your email to confirm.');
      router.push('/signin');
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || 'Sign up failed');
    }
  }

  return (
    <AuthCard title="Create your account">
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
          <PasswordInput value={password} onChange={setPassword} placeholder="Create a password (6+ chars)" />
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
          Password must be at least 6 characters. Use a mix of letters and numbers for better security.
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full py-3 rounded bg-green-600 text-white font-medium disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <div className="text-center text-sm">
          Already have an account? <a href="/signin" className="text-blue-600 underline">Sign in</a>
        </div>
      </form>
    </AuthCard>
  );
}
