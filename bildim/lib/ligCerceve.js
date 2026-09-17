// ============================================================
// LİG ÇERÇEVESİ (Aşama 2D-E) — lig atlayınca kazanılan KALICI avatar çerçevesi
//
// Kazanma ve saklama sunucuda (migration 213: lig_cerceveleri + profiles.gorunum.lig_cerceve).
// Başkasının görünüm kaydı istemciye kapalı olduğu için seçili çerçeve toplu RPC'yle
// (oyuncu_lig_cerceveleri) okunur; aynı karede istenen kimlikler tek çağrıda gider,
// sonuç oturum boyunca önbellekte kalır (nadirlik.js ile aynı desen).
// ============================================================
import { supabase } from "../../src/lib/supabase.js";
import { tt } from "./dil.js";

/** Lig sırası (sunucudaki lig_sirasi ile aynı). Bronz'un çerçevesi yok. */
export const LIG_CERCEVELERI = ["gumus", "altin", "elmas", "efsane"];
export const LIG_CERCEVE_ADI = {
  gumus: tt("Gümüş"), altin: tt("Altın"), elmas: tt("Elmas"), efsane: tt("Efsane"),
};

const onbellek = new Map();   // user_id → lig | null
let kuyruk = new Map();       // user_id → [coz, ...]
let zamanlayici = null;

async function kuyrugaBak() {
  const istekler = kuyruk;
  kuyruk = new Map();
  zamanlayici = null;
  const sonuc = new Map();
  try {
    const { data, error } = await supabase.rpc("oyuncu_lig_cerceveleri", { p_idler: [...istekler.keys()] });
    if (error) throw error;
    for (const r of data ?? []) sonuc.set(r.id, LIG_CERCEVELERI.includes(r.cerceve) ? r.cerceve : null);
  } catch (e) {
    console.warn("[Bildim] lig çerçeveleri alınamadı:", e?.message ?? e);
  }
  for (const [id, cozucler] of istekler) {
    const c = sonuc.get(id) ?? null;
    onbellek.set(id, c);
    for (const coz of cozucler) coz(c);
  }
}

/** Oyuncunun seçili lig çerçevesi (yoksa null). */
export function ligCerceveAl(userId) {
  if (!userId) return Promise.resolve(null);
  if (onbellek.has(userId)) return Promise.resolve(onbellek.get(userId));
  return new Promise((coz) => {
    const liste = kuyruk.get(userId) ?? [];
    liste.push(coz);
    kuyruk.set(userId, liste);
    if (!zamanlayici) zamanlayici = setTimeout(kuyrugaBak, 30);
  });
}

/** Kendi seçimimiz değişince önbellek tazelensin. */
export function ligCerceveUnut(userId) {
  if (userId) onbellek.delete(userId); else onbellek.clear();
  for (const f of dinleyiciler) { try { f(userId); } catch { /* yut */ } }
}

const dinleyiciler = new Set();
/** Seçim değişince açık AvatarCerceve'ler yeniden okusun. */
export function ligCerceveDinle(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }

/** Kazanılan çerçeveler + seçili (yalnız kendimiz). */
export async function ligCercevelerim() {
  const { data, error } = await supabase.rpc("lig_cercevelerim");
  if (error) throw error;
  return data ?? [];
}

/** Çerçeve seç; null = çerçevesiz. */
export async function ligCerceveSec(lig, userId) {
  const { error } = await supabase.rpc("lig_cerceve_sec", { p_lig: lig });
  if (error) throw error;
  ligCerceveUnut(userId);
}
