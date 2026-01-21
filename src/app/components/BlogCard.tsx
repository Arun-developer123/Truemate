"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface BlogCardProps {
  title: string;
  excerpt: string;
  slug: string;
  date: string;
}

export default function BlogCard({ title, excerpt, slug, date }: BlogCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <Link href={`/blog/${slug}`}>
        <Card className="rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-neutral-900">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              {excerpt}
            </p>
            <span className="text-xs text-neutral-400">{date}</span>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
