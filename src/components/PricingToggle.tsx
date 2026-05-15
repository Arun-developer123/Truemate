// src/components/PricingToggle.tsx
// (Client component — must be a client module)
// -------------------------

"use client";

import React from "react";

type Props = {
  period: "monthly" | "yearly";
  setPeriod: (p: "monthly" | "yearly") => void;
};

export default function PricingToggle({ period, setPeriod }: Props) {
  return (
    <div className="inline-flex items-center bg-white/90 rounded-full p-1 gap-1 shadow">
      <button
        onClick={() => setPeriod("monthly")}
        className={`px-4 py-2 rounded-full text-sm font-semibold ${period === "monthly" ? "bg-emerald-700 text-white" : "text-emerald-700"}`}>
        Monthly
      </button>
      <button
        onClick={() => setPeriod("yearly")}
        className={`px-4 py-2 rounded-full text-sm font-semibold ${period === "yearly" ? "bg-emerald-700 text-white" : "text-emerald-700"}`}>
        Yearly
      </button>
    </div>
  );
}
