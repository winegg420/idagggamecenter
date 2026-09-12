// Oyun ayarları (oyun_ayarlari tablosu) — tek kaynak, istemci tarafı önbelleği.
//
// Rakamlar (coin ödülleri, reklam sıklığı, joker fiyatları) KODA GÖMÜLMEZ:
// sunucudaki tablodan okunur, böylece SQL ile değiştirilen bir değer
// yeniden dağıtım gerektirmeden oyunda karşılığını bulur. Tablo herkese
// açık okunabilir (RLS: select true).

import { supabase } from "../../src/lib/supabase.js";

let onbellek = null;
let istek = null;

/** Tüm ayarları { anahtar: sayı/değer } olarak döndürür. Hata olursa {} . */
export async function ayarlar() {
  if (onbellek) return onbellek;
  if (istek) return istek;
  istek = (async () => {
    try {
      const { data, error } = await supabase.from("oyun_ayarlari").select("anahtar, deger");
      if (error) throw error;
      const o = {};
      for (const s of data ?? []) o[s.anahtar] = s.deger;
      onbellek = o;
      return o;
    } catch (e) {
      console.error("[Bildim] oyun ayarlari okunamadi:", e);
      return {}; // varsayılanlarla devam edilir
    } finally {
      istek = null;
    }
  })();
  return istek;
}

/** Tek ayar; yoksa verilen varsayılan. */
export async function ayar(anahtar, varsayilan) {
  const o = await ayarlar();
  const v = Number(o?.[anahtar]);
  return Number.isFinite(v) ? v : varsayilan;
}
