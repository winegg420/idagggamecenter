// ============================================================
// GÖLGE BOKS — veri katmanı (Supabase + yerel depolama)
//
// ÇEVRİMDIŞI MOD: oyun internetsiz de oynanır. Oturum kaydı başarısız olursa
// paket localStorage kuyruğuna yazılır; uygulama bir sonraki açılışta ya da
// `online` olayında kuyruğu boşaltır. Böylece skor/istatistik kaybolmaz.
//
// Tercihler hem sunucuda (cihazlar arası) hem yerelde (çevrimdışı ilk açılış)
// tutulur; yerel kopya her zaman anında okunur, sunucu kopyası üstüne yazar.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

const ANAHTAR_TERCIH = "boks_tercih";
const ANAHTAR_KUYRUK = "boks_kuyruk";
const ANAHTAR_PROGRAM = "boks_program";
const ANAHTAR_KARIYER = "boks_kariyer_onbellek";

export const VARSAYILAN_TERCIH = {
  durus: "ortodoks",
  eldiven_turu: "boks",
  eldiven_renk: "#ff4d3d",
  koc_kisilik: "agresif",
  kilo_kg: null,
  onerilen_zorluk: null,
  ses_acik: true,
  koc_acik: true,
};

function jsonOku(anahtar, varsayilan) {
  try {
    const ham = localStorage.getItem(anahtar);
    if (!ham) return varsayilan;
    const v = JSON.parse(ham);
    return v == null ? varsayilan : v;
  } catch {
    return varsayilan;
  }
}

function jsonYaz(anahtar, deger) {
  try {
    localStorage.setItem(anahtar, JSON.stringify(deger));
  } catch {
    /* kota dolu / gizli mod — yerel kayıt yoksa da oyun çalışır */
  }
}

// ---------------- tercihler ----------------
export function yerelTercih() {
  return { ...VARSAYILAN_TERCIH, ...jsonOku(ANAHTAR_TERCIH, {}) };
}

export function yerelTercihYaz(t) {
  jsonYaz(ANAHTAR_TERCIH, { ...yerelTercih(), ...t });
}

/** Sunucudaki tercihi çeker; yoksa/başarısızsa yerel kopyayı döndürür. */
export async function tercihYukle() {
  const yerel = yerelTercih();
  try {
    const { data, error } = await supabase
      .from("boks_tercihler")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const birlesik = { ...yerel, ...data };
      jsonYaz(ANAHTAR_TERCIH, birlesik);
      return birlesik;
    }
  } catch (e) {
    console.warn("[Boks] Tercih yüklenemedi, yerel kopya kullanılıyor:", e?.message || e);
  }
  return yerel;
}

/** Tercihi yerelde anında, sunucuda en iyi çabayla kaydeder. */
export async function tercihKaydet(t) {
  const birlesik = { ...yerelTercih(), ...t };
  jsonYaz(ANAHTAR_TERCIH, birlesik);
  try {
    const { error } = await supabase.rpc("boks_tercih_kaydet", { p: birlesik });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[Boks] Tercih sunucuya yazılamadı (yerelde saklandı):", e?.message || e);
    return false;
  }
}

// ---------------- çevrimdışı kuyruk ----------------
function kuyrukOku() {
  const k = jsonOku(ANAHTAR_KUYRUK, []);
  return Array.isArray(k) ? k : [];
}

function kuyrugaEkle(paket) {
  const k = kuyrukOku();
  k.push({ ...paket, _t: Date.now() });
  // Kuyruk sınırsız büyümesin (en yeni 20 oturum yeterlidir).
  jsonYaz(ANAHTAR_KUYRUK, k.slice(-20));
}

/** Bekleyen oturum sayısı (arayüzde "N antrenman senkron bekliyor"). */
export function bekleyenSayisi() {
  return kuyrukOku().length;
}

async function paketGonder(p) {
  const { data, error } = await supabase.rpc("boks_oturum_kaydet", {
    p_mod: p.mod,
    p_zorluk: p.zorluk,
    p_ozet: p.ozet,
    p_roundlar: p.roundlar,
    p_zayifliklar: p.zayifliklar || [],
    p_rozetler: p.rozetler || [],
  });
  if (error) throw error;
  return data;
}

/**
 * Oturumu kaydeder. Başarısız olursa (çevrimdışı/hata) kuyruğa alır ve
 * `{ ok:false, kuyruklandi:true }` döner — oyun akışı bozulmaz.
 */
export async function oturumKaydet(paket) {
  try {
    const sonuc = await paketGonder(paket);
    return { ok: true, sonuc };
  } catch (e) {
    console.warn("[Boks] Oturum kaydedilemedi, kuyruğa alındı:", e?.message || e);
    kuyrugaEkle(paket);
    return { ok: false, kuyruklandi: true, hata: e?.message || String(e) };
  }
}

/** Kuyruktaki oturumları sırayla gönderir (internet gelince). */
export async function kuyrukSenkron() {
  const k = kuyrukOku();
  if (!k.length) return { gonderilen: 0, kalan: 0 };
  const kalan = [];
  let gonderilen = 0;
  for (const p of k) {
    try {
      await paketGonder(p);
      gonderilen++;
    } catch {
      kalan.push(p); // hâlâ gönderilemiyor — kuyrukta kalsın
    }
  }
  jsonYaz(ANAHTAR_KUYRUK, kalan);
  return { gonderilen, kalan: kalan.length };
}

// ---------------- kariyer / sıralama ----------------
export async function kariyerGetir() {
  try {
    const { data, error } = await supabase.rpc("boks_kariyer_getir");
    if (error) throw error;
    if (data) jsonYaz(ANAHTAR_KARIYER, data);
    return data;
  } catch (e) {
    console.warn("[Boks] Kariyer verisi alınamadı, önbellek kullanılıyor:", e?.message || e);
    return jsonOku(ANAHTAR_KARIYER, null);
  }
}

/** Çevrimdışı açılışta anında gösterilecek son bilinen kariyer verisi. */
export function kariyerOnbellek() {
  return jsonOku(ANAHTAR_KARIYER, null);
}

export async function siralamaGetir(mod) {
  const { data, error } = await supabase.rpc("boks_siralama", { p_mod: mod });
  if (error) throw error;
  return data || [];
}

export async function sezonSiralamaGetir() {
  const { data, error } = await supabase.rpc("boks_sezon_siralama");
  if (error) throw error;
  return data || [];
}

// ---------------- program ilerlemesi (yerel) ----------------
export function programDurum() {
  return jsonOku(ANAHTAR_PROGRAM, { kod: null, tamamlanan: 0, sonGun: null });
}

export function programSec(kod) {
  jsonYaz(ANAHTAR_PROGRAM, { kod, tamamlanan: 0, sonGun: null });
}

export function programGunTamamla() {
  const d = programDurum();
  const bugun = new Date().toISOString().slice(0, 10);
  if (d.sonGun === bugun) return d; // aynı gün iki kez ilerlemez
  const yeni = { ...d, tamamlanan: (d.tamamlanan || 0) + 1, sonGun: bugun };
  jsonYaz(ANAHTAR_PROGRAM, yeni);
  return yeni;
}

export function programBirak() {
  jsonYaz(ANAHTAR_PROGRAM, { kod: null, tamamlanan: 0, sonGun: null });
}
