// ============================================================
// KAFA TOPU — Supabase Realtime maç kanalı (host-otoriter model).
// slot 0 = host: simülasyonu çalıştırır, "durum" yayınlar (20Hz).
// Misafirler: "girdi" yayınlar, "durum"u render eder.
// Presence ile kimin bağlı olduğu izlenir (kopma tespiti).
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

export function macKanaliKur(macId, benimId, olaylar = {}) {
  const kanal = supabase.channel(`kt-mac-${macId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: benimId },
    },
  });

  kanal
    .on("broadcast", { event: "durum" }, ({ payload }) => olaylar.onDurum?.(payload))
    .on("broadcast", { event: "girdi" }, ({ payload }) => olaylar.onGirdi?.(payload))
    .on("broadcast", { event: "bitti" }, ({ payload }) => olaylar.onBitti?.(payload))
    .on("presence", { event: "sync" }, () => {
      try {
        olaylar.onKatilim?.(Object.keys(kanal.presenceState()));
      } catch (e) {
        console.error("KafaTopu presence hatası:", e);
      }
    });

  kanal.subscribe(async (durum) => {
    try {
      if (durum === "SUBSCRIBED") {
        await kanal.track({ user_id: benimId, t: Date.now() });
        olaylar.onBaglandi?.();
      } else if (durum === "CHANNEL_ERROR" || durum === "TIMED_OUT") {
        olaylar.onHata?.(durum);
      }
    } catch (e) {
      console.error("KafaTopu kanal aboneliği hatası:", e);
      olaylar.onHata?.(String(e));
    }
  });

  return {
    yayinla(event, payload) {
      try {
        kanal.send({ type: "broadcast", event, payload });
      } catch (e) {
        console.error("KafaTopu yayın hatası:", e);
      }
    },
    kapat() {
      try {
        supabase.removeChannel(kanal);
      } catch (e) {
        console.error("KafaTopu kanal kapatma hatası:", e);
      }
    },
  };
}
