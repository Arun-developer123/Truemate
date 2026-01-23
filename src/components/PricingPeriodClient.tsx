"use client";

import { useState, useEffect } from "react";
import PricingToggle from "@/components/PricingToggle";

export default function PricingPeriodClient() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("truemate_pricing_period");
      if (saved === "monthly" || saved === "yearly") {
        setPeriod(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("truemate_pricing_period", period);
    } catch {}
  }, [period]);

  return (
    <div className="flex flex-col items-end">
      <div className="mb-2 text-sm text-slate-600">Billing</div>
      <PricingToggle period={period} setPeriod={setPeriod} />
    </div>
  );
}
