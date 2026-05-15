"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  Save,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ProfileState = {
  name: string;
  avatarUrl: string;
  email: string;
};

export default function ProfileEditPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    avatarUrl: "/aarvi.jpg",
    email: "",
  });

  const [preview, setPreview] = useState<string>("/aarvi.jpg");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/signin");
        return;
      }

      const metaName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.user_metadata?.display_name ||
        "";

      const avatar =
        data.user.user_metadata?.avatar_url ||
        data.user.user_metadata?.photo_url ||
        "/aarvi.jpg";

      setProfile({
        name: metaName || data.user.email?.split("@")[0] || "Arun",
        avatarUrl: avatar,
        email: data.user.email || "",
      });
      setPreview(avatar);
      setLoading(false);
    };

    boot();
  }, [router]);

  const canSave = useMemo(() => {
    return profile.name.trim().length >= 2 && !saving && !loading;
  }, [profile.name, saving, loading]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Image should be under 2MB.");
      return;
    }

    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setPreview(result);
        setProfile((prev) => ({ ...prev, avatarUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    setErrorMsg("");
    setSuccess(false);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: profile.name.trim(),
        name: profile.name.trim(),
        display_name: profile.name.trim(),
        avatar_url: profile.avatarUrl,
      },
    });

    if (error) {
      setErrorMsg(error.message || "Failed to save profile.");
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);

    setTimeout(() => {
      router.push("/profile");
      router.refresh();
    }, 700);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#090812] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,92,160,0.18),transparent_18%),radial-gradient(circle_at_82%_20%,rgba(161,88,255,0.12),transparent_20%),linear-gradient(180deg,#0d0c18_0%,#07060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1000px] flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <motion.div
          initial={mounted ? { opacity: 0, y: 14 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="rounded-[2.3rem] border border-white/10 bg-white/5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
            <button
              onClick={() => router.back()}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <p className="text-xs tracking-[0.22em] text-[#ff5aa6]">EDIT PROFILE</p>
              <h1 className="text-lg font-semibold sm:text-xl">Update your details</h1>
            </div>

            <button
              onClick={() => router.push("/profile")}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.85fr_1.15fr] lg:p-8">
            <section className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col items-center text-center">
                <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <Image
                    src={preview}
                    alt="Profile preview"
                    fill
                    className="object-cover object-center"
                    unoptimized
                  />
                  <label className="absolute bottom-2 right-2 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/10 bg-black/65 backdrop-blur-md">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  {profile.name || "Your name"}
                </h2>
                <p className="mt-1 text-sm text-white/65">
                  {profile.email || "No email found"}
                </p>

                <div className="mt-5 w-full rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Tip</p>
                      <p className="mt-1 text-sm leading-6 text-white/65">
                        Best results come from a square image. Under 2MB works smoothly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 w-full space-y-3">
                  <button
                    onClick={() => setPreview("/aarvi.jpg")}
                    className="flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div>
                      <p className="font-medium">Use default avatar</p>
                      <p className="text-sm text-white/62">Restore Aarvi image</p>
                    </div>
                    <Check className="h-5 w-5 text-white/50" />
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">BASIC INFO</p>
                <h3 className="mt-1 text-xl font-semibold">Name and avatar</h3>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Display name</label>
                    <input
                      value={profile.name}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Enter your name"
                      className="w-full rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-[#ff5aa6]/60"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/70">Avatar URL / preview</label>
                    <input
                      value={profile.avatarUrl}
                      onChange={(e) => {
                        setProfile((prev) => ({ ...prev, avatarUrl: e.target.value }));
                        setPreview(e.target.value);
                      }}
                      placeholder="Paste image URL or upload from device"
                      className="w-full rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-[#ff5aa6]/60"
                    />
                    <p className="mt-2 text-xs text-white/50">
                      Uploading a file will convert it to preview data immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">STATUS</p>
                <h3 className="mt-1 text-xl font-semibold">Save changes</h3>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => router.back()}
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-white/85"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className="flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(90deg,#ff4f7b_0%,#cf2fff_100%)] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : success ? (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-5 w-5" />
                        Save profile
                      </>
                    )}
                  </button>
                </div>

                {errorMsg && (
                  <p className="mt-4 rounded-[1.1rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMsg}
                  </p>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
  );
}