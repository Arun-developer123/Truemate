'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { registerServiceWorkerAndSubscribe } from '@/lib/pushClient';

// Types
type Role = 'user' | 'assistant' | 'system';
type Message = {
  role: Role;
  content: string;
  proactive?: boolean;
  created_at?: string;
  seen?: boolean;
};

// Small presentational components (kept inside file for simplicity)
function Avatar({ name }: { name: string | null }) {
  const initial = name ? name.charAt(0).toUpperCase() : 'T';
  return (
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg shadow">
      {initial}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const base = 'p-3 rounded-xl max-w-[78%] shadow break-words';
  if (msg.role === 'user')
    return (
      <div className={`${base} bg-indigo-600 text-white self-end`}>
        <div>{msg.content}</div>
        <div className="text-xs opacity-70 mt-1 text-right">{time}</div>
      </div>
    );

  return (
    <div className={`${base} bg-white/95 text-gray-900 border`}>
      <div className="font-medium">{msg.proactive ? 'Nyra • Reminder' : 'Nyra'}</div>
      <div className="mt-1">{msg.content}</div>
      <div className="text-xs opacity-60 mt-2">{time}</div>
    </div>
  );
}

function GalleryModal({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  useEffect(() => setIndex(startIndex), [startIndex]);
  if (!images || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-sm font-semibold">
            Gallery ({index + 1}/{images.length})
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="px-3 py-1 rounded bg-gray-100">
              Prev
            </button>
            <button onClick={() => setIndex((i) => (i + 1) % images.length)} className="px-3 py-1 rounded bg-gray-100">
              Next
            </button>
            <button onClick={onClose} className="px-3 py-1 rounded bg-red-100">
              Close
            </button>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-50" style={{ minHeight: 360 }}>
          <img src={images[index]} alt={`gallery-${index}`} className="max-h-[70vh] object-contain rounded" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  const router = useRouter();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollToBottom();
  }, [messages]);

  const dedupeMessages = (arr: Message[]) => {
    const seen = new Set<string>();
    return arr.filter((m) => {
      const key = `${m.role}|${m.content}|${m.created_at || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push('/signin');
        return;
      }
      const email = data.user.email ?? null;
      setUserEmail(email);

      if (email) {
        const { data: existingData, error: fetchError } = await supabase
          .from('users_data')
          .select('chat')
          .eq('email', email)
          .maybeSingle();

        if (fetchError) console.error('Supabase fetch chat error:', fetchError.message);
        else if (existingData?.chat) setMessages(dedupeMessages(existingData.chat));
      }
    };
    getUser();
  }, [router]);

  // Realtime listener
  useEffect(() => {
    if (!userEmail) return;

    const handleRealtime = (payload: any) => {
      const incoming: Message[] = payload?.new?.chat ?? [];
      const clean = dedupeMessages(incoming);
      if (JSON.stringify(clean) === JSON.stringify(messagesRef.current)) return;
      setMessages(clean);
      const latest = clean[clean.length - 1];
      if (latest?.role === 'assistant' && latest?.proactive && !latest?.seen) {
        setUnreadCount((c) => c + 1);
        if (Notification.permission === 'granted') new Notification('Truemate • Nyra', { body: latest.content });
      }
    };

    const channel = supabase
      .channel('chat-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users_data', filter: `email=eq.${userEmail}` },
        handleRealtime
      )
      .subscribe();

    // IMPORTANT: do NOT return a Promise from the cleanup.
    return () => {
      // call removeChannel but don't return its Promise
      void supabase.removeChannel(channel);
    };
  }, [userEmail]);

  // Polling fallback
  useEffect(() => {
    if (!userEmail) return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from('users_data').select('chat').eq('email', userEmail).maybeSingle();
      if (error) console.error('Polling fetch error:', error.message);
      else if (data?.chat) {
        const clean = dedupeMessages(data.chat);
        if (JSON.stringify(clean) !== JSON.stringify(messagesRef.current)) setMessages(clean);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [userEmail]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === 'granted') {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return;
      // call and ignore promise in effect (do not return it)
      registerServiceWorkerAndSubscribe(vapid, userEmail).catch(() => console.warn('Push registration failed'));
    }
  }, [userEmail]);

  useEffect(() => {
    // mark proactive as seen
    if (!userEmail) return;
    const markSeen = async () => {
      if (messages.some((m) => m.proactive && !m.seen)) {
        const updated = messages.map((m) => (m.proactive ? { ...m, seen: true } : m));
        setMessages(updated);
        await supabase.from('users_data').update({ chat: updated, updated_at: new Date().toISOString() }).eq('email', userEmail);
      }
    };
    markSeen();
  }, [messages, userEmail]);

  const scrollToBottom = () => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  };

  const handleSend = async () => {
    if (!input.trim() || !userEmail || sending) return;
    setSending(true);
    const userMsg: Message = { role: 'user', content: input, created_at: new Date().toISOString() };

    try {
      const optimistic = [...messagesRef.current, userMsg];
      setMessages(optimistic);
      setInput('');

      // call api
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: input }) });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I'm here but couldn’t form a response — try again.";
      const assistantMsg: Message = { role: 'assistant', content: reply, created_at: new Date().toISOString() };

      const updatedMessages = [...optimistic, assistantMsg];
      setMessages(updatedMessages);

      await supabase.from('users_data').update({ chat: updatedMessages, updated_at: new Date().toISOString() }).eq('email', userEmail);

      // analyze
      await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, message: input }) });
    } catch (err) {
      console.error('handleSend failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  // Gallery helper — load example images from /public/gallery
  useEffect(() => {
    const imgs = ['/gallery/1.jpg', '/gallery/2.jpg', '/gallery/3.jpg', '/gallery/4.jpg']; // adjust to your files
    setGalleryImages(imgs);
  }, []);

  const greeting = (() => {
    if (!userEmail) return 'Hello';
    const name = userEmail.split('@')[0];
    return `Hi, ${name.charAt(0).toUpperCase() + name.slice(1)} 👋`;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white text-gray-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        {/* Sidebar profile & gallery */}
        <aside className="col-span-1 bg-white/90 rounded-2xl p-4 shadow sticky top-6 h-fit">
          <div className="flex items-center gap-3">
            <Avatar name={userEmail} />
            <div>
              <div className="text-sm font-semibold">{greeting}</div>
              <div className="text-xs text-gray-500">{userEmail}</div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-700">
            Nyra is your supportive AI friend — she remembers your context and sends gentle reminders when needed. Use the gallery to view memories and visuals that help ground the conversation.
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setGalleryOpen(true)} className="flex-1 py-2 rounded bg-pink-500 text-white">Open Gallery</button>
            <button onClick={handleSignOut} className="py-2 px-3 rounded bg-red-100 text-red-700">Sign Out</button>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-600">Quick tips</h4>
            <ul className="mt-2 text-sm text-gray-600 space-y-1">
              <li>• Press Enter to send (Shift+Enter for newline)</li>
              <li>• Nyra replies conversationally — try asking how she’s feeling</li>
            </ul>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-600">Mini Gallery</h4>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {galleryImages.slice(0, 6).map((src, i) => (
                <button key={i} onClick={() => { setGalleryIndex(i); setGalleryOpen(true); }} className="rounded overflow-hidden">
                  <img src={src} alt={`thumb-${i}`} className="h-20 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat area */}
        <section className="col-span-1 lg:col-span-2 bg-white/95 rounded-3xl p-4 shadow flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Truemate Chat</h2>
              <div className="text-sm text-gray-500">A safe, calm space to talk — Nyra listens.</div>
            </div>
            <div className="text-sm text-gray-500">Unread <span className="font-semibold">{unreadCount}</span></div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-3" style={{ maxHeight: '65vh' }}>
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-12">No messages yet — say hi to start a gentle conversation.</div>
            )}

            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <MessageBubble msg={m} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Share anything — Nyra cares."
                className="flex-1 p-3 rounded-xl border resize-none focus:outline-none"
                rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button onClick={handleSend} disabled={sending} className={`px-4 py-2 rounded-xl ${sending ? 'bg-gray-300' : 'bg-purple-600 text-white'}`}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </section>

        {/* Right column — resources / gallery preview */}
        <aside className="col-span-1 bg-white/90 rounded-2xl p-4 shadow sticky top-6 h-fit">
          <h4 className="text-sm font-semibold">Mood & Prompts</h4>
          <div className="mt-2 space-y-2">
            <button className="w-full text-left p-2 rounded hover:bg-gray-50" onClick={() => { setInput('I am feeling stressed — can you help me relax?'); }}>
              I feel stressed
            </button>
            <button className="w-full text-left p-2 rounded hover:bg-gray-50" onClick={() => { setInput('Give me a short study plan for today.'); }}>
              Study plan
            </button>
            <button className="w-full text-left p-2 rounded hover:bg-gray-50" onClick={() => { setInput('Remind me to take breaks every 45 minutes.'); }}>
              Set gentle reminders
            </button>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold">Gallery preview</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {galleryImages.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => { setGalleryOpen(true); setGalleryIndex(i); }} className="rounded overflow-hidden">
                  <img src={s} alt={`pre-${i}`} className="h-20 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {galleryOpen && <GalleryModal images={galleryImages} startIndex={galleryIndex} onClose={() => setGalleryOpen(false)} />}
    </div>
  );
}

/*
Notes:
- Place gallery images inside `public/gallery/1.jpg`, `2.jpg`, etc.
- This file is client-only and uses Tailwind for styling. Ensure Tailwind is configured.
- For a more dynamic gallery, you can fetch image URLs from the DB (e.g., users_data.gallery array).
- Consider adding animated micro-interactions (framer-motion) and accessible focus traps for the modal.
*/
