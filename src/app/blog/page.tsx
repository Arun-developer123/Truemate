// src/app/blog/page.tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { POSTS } from "./posts";

// load client component normally (no SSR-wrapping needed)
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: "Truemate Blog — Insights on Connection, Productivity & AI",
  description:
    "Truemate Blog: long-form, practical articles about emotional connection, AI companions, productivity, and emotional intelligence.",
  openGraph: {
    title: "Truemate Blog — Insights on Connection, Productivity & AI",
    description:
      "Truemate Blog: long-form, practical articles about emotional connection, AI companions, productivity, and emotional intelligence.",
  },
};

export default function Page() {
  return (
    <>
      {/* Server-side JSON-LD for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "Truemate Blog",
            url: "https://your-domain.com/blog",
            description: metadata.description,
            blogPost: POSTS.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              author: { "@type": "Person", name: p.author },
              datePublished: p.isoDate,
              description: p.excerpt,
            })),
          }),
        }}
      />
      {/* Client-side interactive blog */}
      <BlogPageClient />
    </>
  );
}
