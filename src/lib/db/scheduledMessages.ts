"use server";

import { supabase } from "@/lib/supabaseClient";

// ---- Types ----
export type ScheduledMessage = {
  id: string;
  user_id: string;
  created_by: string;
  trigger_event?: string | null;
  next_message_text: string;
  next_message_time: string; // ISO string
  priority: number;
  urgency: boolean;
  channel: string;
  send_jitter_seconds: number;
  idempotency_key?: string | null;
  metadata: any;
  status: "pending" | "sent" | "cancelled" | "failed";
  created_at: string;
  sent_at?: string | null;
  updated_at: string;
};

// ---- Insert a new scheduled message ----
export async function insertScheduledMessage(
  msg: Omit<ScheduledMessage, "id" | "created_at" | "updated_at" | "status">
) {
  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert([
      {
        ...msg,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledMessage;
}

// ---- Fetch due messages (to be sent) ----
export async function fetchDueMessages(limit: number = 50) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("next_message_time", now)
    .order("priority", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as ScheduledMessage[];
}

// ---- Mark message as sent ----
export async function markMessageSent(id: string) {
  const { data, error } = await supabase
    .from("scheduled_messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledMessage;
}

// ---- Cancel message ----
export async function cancelMessage(id: string) {
  const { data, error } = await supabase
    .from("scheduled_messages")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledMessage;
}
