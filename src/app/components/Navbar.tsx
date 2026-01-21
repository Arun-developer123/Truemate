import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-6 max-w-6xl mx-auto">
      <Link href="/" className="text-2xl font-bold text-purple-600">
        Truemate
      </Link>
      <div className="flex gap-6 text-gray-700">
        <Link href="/blog">Blog</Link>
        <a href="#waitlist">Waitlist</a>
      </div>
    </nav>
  );
}
