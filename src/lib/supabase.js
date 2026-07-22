import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseHazir = Boolean(url && anonKey);

// realtime eventsPerSecond: 20 — gerçek zamanlı oyunlar (Kafa Topu, DriftGP,
// PatiRun) pozisyon/durum senkronunu yüksek Hz gönderir; varsayılan 10/s dar kalır.
export const supabase = supabaseHazir
  ? createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 20 } } })
  : null;
