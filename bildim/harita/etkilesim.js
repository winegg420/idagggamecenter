// ============================================================
// MEYDAN ETKİLEŞİMLERİ — mantık, ağ ve coin katmanı
//
// Haritada başka bir oyuncuya dokununca açılan menünün ARKASI burada:
// hangi seçenekler var, sunucuya ne söylenir, coin ne zaman düşer/iade
// edilir, teklif ne zaman zaman aşımına uğrar.
//
// MİMARİ ŞARTI: bu dosya three.js'i, avatar modelini ve animasyonları
// HİÇ BİLMEZ. Görsel taraf (kahve içme jesti, kahkaha, uçan balonlar)
// ikramGorsel.js'te. Harita baştan çizilse, karakterler değişse bile bu
// dosya olduğu gibi çalışmaya devam eder — tek yapılacak, yeni görsel
// katmanın aynı olayları dinlemesi.
//
// Sunucu sözleşmesi (migration 153):
//   ikram_gonder(p_alan, p_tur)  -> { ikram_id, ikram_coin, bakiye }
//   ikram_yanitla(p_id, p_kabul) -> 'kabul' | 'red' | 'zaman_asimi'
//   ikramlarim()                 -> bekleyen teklifler (broadcast kaçarsa)
// Coin SUNUCUDA düşülür; istemciye güvenilmez.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

/** Menüdeki seçenekler. Görsel katman yalnız `kod` değerlerini bilir. */
export const MENU = [
  { kod: "meydan", ad: "Meydan oku", ikon: "kilic", coin: 0 },
  { kod: "kahve", ad: "Kahve ikram et", ikon: "kahve", coin: 5 },
  { kod: "balon", ad: "Balon ikram et", ikon: "hediye", coin: 5 },
];

/** İkram teklifi gönderir. Coin sunucuda düşer. */
export async function ikramGonder(alanId, tur) {
  const { data, error } = await supabase.rpc("ikram_gonder", {
    p_alan: alanId,
    p_tur: tur,
  });
  if (error) throw error;
  const s = Array.isArray(data) ? data[0] : data;
  return { id: s?.ikram_id, coin: s?.ikram_coin ?? 0, bakiye: s?.bakiye ?? null };
}

/** Teklifi yanıtlar. Reddedilirse coini sunucu iade eder. */
export async function ikramYanitla(ikramId, kabul) {
  const { data, error } = await supabase.rpc("ikram_yanitla", {
    p_id: ikramId,
    p_kabul: kabul,
  });
  if (error) throw error;
  return data;
}

/** Bekleyen teklifler — broadcast paketi kaybolursa yedek yol. */
export async function bekleyenIkramlar() {
  const { data, error } = await supabase.rpc("ikramlarim");
  if (error) throw error;
  return data ?? [];
}

/**
 * Teklif zaman aşımı süresi (sn). Sunucudaki `ikram_zaman_asimi_sn` ile
 * aynı olmalı; ayar okunamazsa buradaki kullanılır.
 */
export const ZAMAN_ASIMI_SN = 20;

/** İkram jestinin ekranda süreceği saniye (sunucudaki `ikram_sure_sn`). */
export const IKRAM_SURE_SN = 15;
