// ============================================================
// MEYDANDAKİ BOTLAR — nöbet listesi ve gezinme
//
// Botlar gerçek istemci olmadığı için Realtime presence'a katılamaz.
// Bunun yerine sunucu, turnuva saatine yakın 1-2 gizli botu "nöbete"
// yazar (meydan_bot_nobeti, bkz. migration 150) ve her istemci listeyi
// okuyup botu TOHUMDAN türeyen bir rotada yürütür. Tohum ortak olduğu
// için herkes botu aynı yerde görür.
//
// MİMARİ: burada yalnız MANTIK var (kim meydanda, hangi anda nerede).
// Avatarın nasıl çizildiği HaritaSayfasi + dunya.js'te; harita görseli
// değişse de bu dosya aynen çalışır.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

const MERKEZ_YARICAP = 16;   // botlar meydanın ortasında dolaşır
const TUR_SN = 90;           // bir turu bu sürede tamamlar

/** Nöbetteki botlar. Hata olursa boş liste — meydan botsuz kalır, sorun değil. */
export async function meydanBotlariniAl() {
  try {
    const { data, error } = await supabase.rpc("meydan_botlari");
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.error("[Meydan] bot nobeti okunamadi:", e);
    return [];
  }
}

/** Tohumdan 0..1 arası kararlı bir sayı (sunucudaki bot_rasgele'nin eşi). */
function tohumSayi(tohum, ek = "") {
  let h = 2166136261;
  const s = String(tohum) + ek;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Botun verilen anda nerede olduğu. YARI PASİF: geniş bir yayda ağır ağır
 * dolaşır, ara ara durur (gerçek oyuncu gibi sürekli koşturmaz).
 * @param {string} tohum  sunucudan gelen nöbet tohumu
 * @param {number} sn     saniye cinsinden zaman (Date.now()/1000)
 */
export function botKonumu(tohum, sn) {
  const faz = tohumSayi(tohum) * Math.PI * 2;
  const yaricap = 6 + tohumSayi(tohum, "r") * (MERKEZ_YARICAP - 6);
  const hiz = 0.6 + tohumSayi(tohum, "h") * 0.5;

  // Duraklar: turun bazı bölümlerinde ilerleme yavaşlar (durup bakınıyor).
  const ham = (sn * hiz) / TUR_SN;
  const duraklamali = ham + Math.sin(ham * Math.PI * 2) * 0.12;
  const aci = faz + duraklamali * Math.PI * 2;

  const x = Math.cos(aci) * yaricap;
  const z = Math.sin(aci) * yaricap;
  // Yürüme yönü teğet
  const yon = Math.atan2(-Math.sin(aci), -Math.cos(aci)) + Math.PI / 2;
  return { x, z, aci: yon };
}

/**
 * Bot bu anda emoji/dans yapıyor mu? NADİREN: ortalama ~40 saniyede bir,
 * tohuma bağlı olduğu için herkes aynı anda görür.
 * @returns {{tur:'emoji'|'dans', deger:string}|null}
 */
export function botJesti(tohum, sn) {
  const pencere = Math.floor(sn / 40);
  const p = tohumSayi(tohum, "j" + pencere);
  if (p > 0.35) return null;                      // çoğu pencerede sessiz
  const icinde = sn % 40;
  if (icinde > 2) return null;                    // yalnız pencerenin başında
  if (p < 0.12) return { tur: "dans", deger: "dns_01" };
  const emojiler = ["👍", "😂", "🔥", "😎", "👋"];
  return { tur: "emoji", deger: emojiler[Math.floor(p * 100) % emojiler.length] };
}
