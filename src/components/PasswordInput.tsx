'use client';
import React, { useState } from 'react';


export default function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
const [visible, setVisible] = useState(false);
return (
<div className="relative">
<input
type={visible ? 'text' : 'password'}
value={value}
onChange={(e) => onChange(e.target.value)}
placeholder={placeholder || 'Password'}
className="border p-3 pr-12 rounded w-full"
aria-label="Password"
/>
<button
type="button"
onClick={() => setVisible((s) => !s)}
className="absolute right-2 top-1/2 -translate-y-1/2 text-sm opacity-75"
aria-label={visible ? 'Hide password' : 'Show password'}
>
{visible ? 'Hide' : 'Show'}
</button>
</div>
);
}