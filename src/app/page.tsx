"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-500 to-indigo-700 text-white">
      {/* Hero Section */}
      <div className="text-center px-6">
        <h1 className="text-5xl font-extrabold mb-4">Welcome to Truemate</h1>
        <p className="text-lg mb-8 max-w-xl mx-auto">
          Your personal AI companion for chatting, games, challenges, and more.  
          Stay productive while having fun 🎯
        </p>

        {/* Get Started Button */}
        <button
          onClick={() => router.push("/signin")}
          className="bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl shadow-lg hover:bg-gray-100 transition"
        >
          Get Started →
        </button>
      </div>

      {/* Footer / Small Features Teaser */}
      <div className="absolute bottom-6 text-center text-sm opacity-80">
        <p>✨ Chat • 🎮 Games • 📆 Challenges • 🏆 Achievements • 🥚 Easter Eggs</p>
      </div>
    </div>
  );
}
