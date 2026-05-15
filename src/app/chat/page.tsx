"use client";

export const dynamic = "force-dynamic";

import React, { Suspense } from "react";
import dynamicImport from "next/dynamic";

const ChatPage = dynamicImport(
  () => import("@/components/chat/ChatPage"),
  {
    ssr: false,
  }
);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}