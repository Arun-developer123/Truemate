// src/app/payment-success/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [status, setStatus] = useState("Finalizing payment...");

  useEffect(() => {
    const finalize = async () => {
      try {
        // Prevent double-finalize on reload / back button
        if (typeof window !== "undefined" && sessionStorage.getItem("payment_done")) {
          setStatus("Payment already finalized.");
          return;
        }

        const url = new URL(window.location.href);

        // PayPal subscription redirect usually contains subscription_id (or subscriptionID)
        const subscriptionId =
          url.searchParams.get("subscription_id") ||
          url.searchParams.get("subscriptionID") ||
          url.searchParams.get("subscriptionId") ||
          null;

        // PayPal one-time order redirect commonly returns token or orderID (your capture flow)
        const orderID = url.searchParams.get("token") || url.searchParams.get("orderID") || null;

        if (!subscriptionId && !orderID) {
          setStatus("No order or subscription id found in URL. If you paid, contact support.");
          return;
        }

        // mark as "in progress" to avoid duplicate calls; we'll remove on failure
        try {
          sessionStorage.setItem("payment_done", "1");
        } catch {
          // ignore sessionStorage errors
        }

        if (subscriptionId) {
          // Subscription flow: prefer webhook as source of truth.
          setStatus("Finalizing subscription...");

          try {
            // Optional: call activate fallback to immediately grant access while webhook arrives.
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data } = await supabase.auth.getUser();
            const email = data.user?.email;

            // Call your activate endpoint if we have an email
            if (email) {
              const act = await fetch("/api/paypal/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, subscriptionId }),
              });

              // don't rely on this response — webhook is authoritative
              if (!act.ok) {
                console.warn("activate fallback returned non-ok", await act.text());
              }
            }
          } catch (err) {
            console.warn("activate fallback failed:", err);
          }

          setStatus("🎉 Subscription approved. It may take a moment to reflect in the app (webhook).");
          return;
        }

        // One-time order flow (backgrounds, captures)
        if (orderID) {
          setStatus("Finalizing purchase...");

          const res = await fetch("/api/backgrounds/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID }),
          });

          const data = await res.json();
          if (!res.ok) {
            console.error("capture failed:", data);
            // cleanup flag so user can retry
            try {
              sessionStorage.removeItem("payment_done");
            } catch {}
            setStatus("Payment capture failed. Contact support.");
            return;
          }

          // Optionally activate subscription fallback if you want — not needed for one-time
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data } = await supabase.auth.getUser();
            const email = data.user?.email;
            if (email) {
              await fetch("/api/paypal/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
            }
          } catch (err) {
            console.warn("activate fallback failed (one-time):", err);
          }

          setStatus("🎉 Payment complete! You should have access now.");
          return;
        }
      } catch (err) {
        console.error(err);
        // cleanup flag on unexpected error so user can retry
        try {
          sessionStorage.removeItem("payment_done");
        } catch {}
        setStatus("Something went wrong finalizing payment.");
      }
    };

    finalize();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-white text-black p-6 rounded-xl shadow-lg">
        <h1 className="text-lg font-semibold mb-2">Payment Result</h1>
        <p>{status}</p>
      </div>
    </div>
  );
}