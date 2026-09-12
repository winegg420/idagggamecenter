// ============================================================
// NADİRLİK — oyuncunun giydiği en değerli eşya
//
// `esyalar.nadirlik` üç değer alır: 'sirali' < 'ozel' < 'etkinlik'.
// Bir oyuncunun çerçevesi, GİYDİĞİ eşyaların en yükseğidir; hiç eşyası
// olmayan 'sirali' çerçeve alır.
//
// NEDEN İSTEMCİDE: lig sıralaması RPC'si `gorunum` döndürmüyor ve o RPC'yi
// değiştirmek migration ister. `profiles` tablosunda select politikası
// herkese açık olduğu için gerekli iki alanı (id, gorunum) doğrudan
// okuyabiliyoruz. Sorgular TOPLU gidiyor: aynı karede istenen bütün
// kimlikler tek sorguda alınır, sonuç oturum boyunca önbellekte kalır.
// ============================================================
import { supabase } from "../../src/lib/supabase.js";

export const NADIRLIK_SIRA = { sirali: 0, ozel: 1, etkinlik: 2 };
export const NADIRLIK_ETIKET = { sirali: "Sıradan", ozel: "Özel", etkinlik: "Etkinlik" };

/** Görünüm kaydında eşya KODU tutan alanlar (renkler hariç). */
const YUVALAR = ["sac", "gozluk", "kupe", "sapka", "ust", "alt", "ayakkabi", "efekt"];

// kod → nadirlik (bir kez yüklenir; yalnız KENDİ görünümümüz için gerekir)
let katalog = null;
let katalogSozu = null;

async function katalogYukle() {
  if (katalog) return katalog;
  if (!katalogSozu) {
    katalogSozu = (async () => {
      try {
        const { data, error } = await supabase.from("esyalar").select("kod, nadirlik");
        if (error) throw error;
        const m = new Map();
        for (const e of data ?? []) m.set(e.kod, e.nadirlik);
        katalog = m;
        return m;
      } catch (e) {
        console.error("[Bildim] nadirlik katalogu alinamadi:", e);
        katalog = new Map();   // bir daha denenmesin; herkes 'sirali' kalır
        return katalog;
      }
    })();
  }
  return katalogSozu;
}

/** Görünüm kaydından en yüksek nadirliği bulur. */
export function gorunumNadirligi(gorunum, katalogHaritasi) {
  let enIyi = "sirali";
  if (!gorunum || typeof gorunum !== "object" || !katalogHaritasi) return enIyi;
  for (const yuva of YUVALAR) {
    const kod = gorunum[yuva];
    if (!kod) continue;
    const n = katalogHaritasi.get(kod);
    if (!n) continue;
    if ((NADIRLIK_SIRA[n] ?? 0) > (NADIRLIK_SIRA[enIyi] ?? 0)) enIyi = n;
  }
  // 2B karakter sistemi: parçalar `kozmetik` altında ANAHTARLA tutulur
  // (hat: "fedora"); katalog anahtarı ise `k2_<yuva>_<anahtar>` kodudur.
  // Çerçeve rengi iki sistemin en yüksek nadirliğinden gelir.
  const koz = gorunum.kozmetik;
  if (koz && typeof koz === "object") {
    for (const [yuva, deger] of Object.entries(koz)) {
      if (yuva.endsWith("Color") || !deger || deger === "yok") continue;
      const n = katalogHaritasi.get(`k2_${yuva}_${deger}`);
      if (!n) continue;
      if ((NADIRLIK_SIRA[n] ?? 0) > (NADIRLIK_SIRA[enIyi] ?? 0)) enIyi = n;
    }
  }
  return enIyi;
}

// ---- toplu okuma ----
// BAŞKA oyuncunun görünümü istemciye KAPALI: `profiles` üzerinde
// `authenticated` rolüne kolon kolon select verilmiş ve `gorunum` o beyaz
// listede yok (gizlilik). Bu yüzden ham kayıt yerine yalnız SONUCU döndüren
// `oyuncu_nadirlikleri` RPC'si kullanılıyor (migration 140).
const onbellek = new Map();     // user_id → nadirlik
let kuyruk = new Map();         // user_id → [resolve, ...]
let zamanlayici = null;
let rpcYok = false;             // migration uygulanmadıysa bir daha denenmez

async function kuyrugaBak() {
  const istekler = kuyruk;
  kuyruk = new Map();
  zamanlayici = null;
  const idler = [...istekler.keys()];
  const sonuc = new Map();

  if (idler.length > 0 && !rpcYok) {
    try {
      const { data, error } = await supabase.rpc("oyuncu_nadirlikleri", { p_idler: idler });
      if (error) throw error;
      for (const r of data ?? []) sonuc.set(r.id, r.nadirlik ?? "sirali");
    } catch (e) {
      // Migration henüz uygulanmadıysa herkes 'sirali' çerçeve alır; ekranlar
      // bozulmaz. Bir kez uyarıp susuyoruz, her satır için log basmıyoruz.
      rpcYok = true;
      console.warn("[Bildim] nadirlik RPC'si yok, gri çerçeveye düşülüyor:", e?.message ?? e);
    }
  }

  for (const [id, cozucler] of istekler) {
    const n = sonuc.get(id) ?? "sirali";
    onbellek.set(id, n);
    for (const c of cozucler) c(n);
  }
}

/**
 * Bir oyuncunun çerçeve nadirliği. Aynı karede istenen kimlikler tek
 * çağrıda toplanır; sonuç önbelleğe alınır.
 * @returns {Promise<"sirali"|"ozel"|"etkinlik">}
 */
export function nadirlikAl(userId) {
  if (!userId) return Promise.resolve("sirali");
  if (onbellek.has(userId)) return Promise.resolve(onbellek.get(userId));
  return new Promise((coz) => {
    const liste = kuyruk.get(userId) ?? [];
    liste.push(coz);
    kuyruk.set(userId, liste);
    if (!zamanlayici) zamanlayici = setTimeout(kuyrugaBak, 30);
  });
}

/** Elimizdeki görünüm kaydından nadirlik (katalog gerekirse yüklenir). */
export async function nadirlikGorunumden(gorunum) {
  const k = await katalogYukle();
  return gorunumNadirligi(gorunum, k);
}

/** Kendi görünümümüz değişince önbellek tazelensin (Görünüm sayfası çağırır). */
export function nadirligiUnut(userId) {
  if (userId) onbellek.delete(userId);
  else onbellek.clear();
}
