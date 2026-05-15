// src/app/blog/BlogPageClient.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { POSTS } from "./posts";

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function BlogPageClient() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [sortNewest, setSortNewest] = useState(true);

  // subscription form state
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    POSTS.forEach((p) => p.categories.forEach((c) => set.add(c)));
    return ["All", ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = POSTS.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" || p.categories.includes(selectedCategory);
      if (!matchesCategory) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.excerpt} ${p.sections
        .map((s) => s.paragraphs.join(" "))
        .join(" ")}`.toLowerCase();
      return hay.includes(q);
    });

    list.sort((a, b) =>
      sortNewest
        ? b.isoDate.localeCompare(a.isoDate)
        : a.isoDate.localeCompare(b.isoDate)
    );
    return list;
  }, [query, selectedCategory, sortNewest]);

  const recent = useMemo(
    () =>
      [...POSTS]
        .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
        .slice(0, 3),
    []
  );

  // ensure one post expanded when the list changes (mobile-friendly default)
  useEffect(() => {
    if (filtered.length === 0) return;
    const firstId = filtered[0].id;
    // open the first post if it's not already expanded
    if (!expanded[firstId]) {
      setExpanded({ [firstId]: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Something went wrong. Try again.");
      } else {
        setMessage("🎉 Thanks for subscribing!");
        setEmail("");
      }
    } catch (err) {
      setMessage("❌ Network error. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <header className="mb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">Truemate Blog</h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
          Long-form articles and practical guides about human connection, productivity, and the responsible future of AI
          companions.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main column: posts */}
        <section className="lg:col-span-3">
          {/* Search + Filters (sticky on desktop) */}
          <div className="sticky top-4 z-10 mb-6 bg-white/90 backdrop-blur rounded-xl p-3 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label htmlFor="search" className="sr-only">
                  Search posts
                </label>
                <input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts, topics, or phrases..."
                  className="w-full border rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="Search posts"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="category" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-xl border px-3 py-2 shadow-sm text-sm"
                  aria-label="Filter by category"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setSortNewest((s) => !s)}
                  className="rounded-xl border px-3 py-2 text-sm shadow-sm"
                  aria-pressed={sortNewest}
                >
                  {sortNewest ? "Newest" : "Oldest"}
                </button>
              </div>
            </div>
          </div>

          {/* Posts list */}
          <div className="space-y-6">
            {filtered.length === 0 && (
              <div className="p-6 border rounded-xl text-center text-gray-600">
                No posts matched your search.
              </div>
            )}

            {filtered.map((post) => (
              <article
                key={post.id}
                id={`post-${post.id}`}
                className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <h2 id={`post-${post.id}-title`} className="text-xl sm:text-2xl font-semibold">
                      {post.title}
                    </h2>
                    <div className="mt-1 text-xs sm:text-sm text-gray-500">
                      By {post.author} • {formatDate(post.isoDate)} • {post.readingMinutes} min read
                    </div>
                  </div>

                  <div className="hidden sm:flex sm:flex-col items-end text-sm text-gray-500">
                    <div className="mb-2">
                      {post.categories.map((c) => (
                        <span key={c} className="inline-block px-2 py-1 mr-1 rounded-full bg-gray-50 text-xs">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs">{post.sections.length} sections</div>
                  </div>
                </div>

                <div className="prose max-w-none">
                  <p className="font-medium text-sm sm:text-base">{post.excerpt}</p>

                  {expanded[post.id] && (
                    <div className="mt-3">
                      {post.sections.map((sec, idx) => (
                        <section key={idx} className="mb-3">
                          {sec.heading && <h3 className="text-lg font-medium">{sec.heading}</h3>}
                          {sec.paragraphs.map((p, i) => (
                            <p key={i} className="text-sm">{p}</p>
                          ))}
                        </section>
                      ))}

                      {post.conclusion && (
                        <div className="mt-2">
                          <strong>Conclusion:</strong>
                          <p className="text-sm">{post.conclusion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <footer className="mt-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpanded((s) => ({ ...s, [post.id]: !s[post.id] }))}
                      className="text-sm underline"
                    >
                      {expanded[post.id] ? "Collapse" : "Read full"}
                    </button>

                    <button
                      onClick={() => {
                        if (typeof navigator !== "undefined" && "share" in navigator) {
                          navigator.share({
                            title: post.title,
                            text: post.excerpt,
                          });
                        }
                      }}
                      className="text-sm text-gray-500"
                      title="Share"
                    >
                      Share
                    </button>
                  </div>

                  <div className="text-sm text-gray-500">
                    <Link href="#top" className="underline">
                      Back to top
                    </Link>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="space-y-6">
            <div className="border rounded-2xl p-4 bg-white shadow-sm">
              <h4 className="font-semibold mb-2">Quick actions</h4>
              <p className="text-sm text-gray-600 mb-3">Jump to a category or see recent posts.</p>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h5 className="font-medium text-sm mb-2">Recent posts</h5>
                <ul className="space-y-2 text-sm">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setExpanded((s) => ({ ...s, [r.id]: true }));
                          document.getElementById(`post-${r.id}`)?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="text-left hover:underline"
                      >
                        {r.title}
                      </button>
                      <div className="text-xs text-gray-400">{formatDate(r.isoDate)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Subscribe */}
            <div className="border rounded-2xl p-4 bg-white shadow-sm">
              <h5 className="font-medium mb-2">Subscribe</h5>
              <p className="text-sm text-gray-600 mb-3">Get new posts to your inbox.</p>
              <form onSubmit={handleSubscribe}>
                <label htmlFor="sub-email" className="sr-only">
                  Email for blog subscription
                </label>
                <input
                  id="sub-email"
                  aria-label="Email for blog subscription"
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border px-3 py-2 mb-3"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full px-4 py-2 bg-indigo-600 text-white disabled:opacity-50"
                >
                  {submitting ? "Subscribing..." : "Subscribe"}
                </button>
              </form>

              {message && <p className="text-sm mt-2 text-center text-gray-600">{message}</p>}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-full px-6 py-3 bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 transition"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
