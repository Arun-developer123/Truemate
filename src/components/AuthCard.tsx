'use client';
import React from 'react';


export default function AuthCard({ children, title }: { children: React.ReactNode; title: string }) {
return (
<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
<div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-2xl p-8 w-full max-w-md">
<h2 className="text-2xl font-semibold mb-4 text-center">{title}</h2>
{children}
</div>
</div>
);
}