// ============================================================
// MEYDANDAKİ BOTLAR — nöbet listesi ve hareket planı
//
// Botlar gerçek istemci olmadığı için Realtime presence'a katılamaz.
// Sunucu gizli botları "nöbete" yazar (meydan_bot_nobeti) ve her nöbetin
// başlangıç/bitiş anını verir. Her istemci aynı TOHUMDAN aynı planı
// kurar; plan sunucu saatine bağlı olduğu için herkes botu aynı yerde
// görür.
//
// PLAN (Revizyon Paketi 6, madde 2 — "binaya gidip yok olmalı, yerine
// başkası girmeli"):
//   1. Nöbet başlarken bir binanın kapısından çıkar, meydana yürür.
//   2. Çeşme ile banklar arasındaki boş halkada dolaşır, ara ara durup
//      bakınır (eski "yarı pasif" his korunur).
//   3. Nöbet biterken bir binaya yürür, kapıya vardığı an kaybolur.
//      Sunucu bir sonraki bota yer açar; o da bir kapıdan girer.
//
// ESKİ HAREKET: tohumdan türeyen SABİT yarıçaplı daire (6-16 birim).
// Bu daire çeşmenin (6.6), bankların (12.5) ve lambaların (15.6)
// içinden geçiyordu — "kaldırıma takılıyor" şikâyetinin sebebi. Artık
// her yol parçası engel listesine karşı denetlenir, çarpacaksa etrafından
// dolaşılır.
//
// MİMARİ: burada yalnız MANTIK var (sayılar: kapı ve engel konumları).
// Avatarın nasıl çizildiği HaritaSayfasi + dunya.js'te; harita görseli
// değişse de bu dosya aynen çalışır — yeni haritanın engel/bina listesi
// verilmesi yeter.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

/** Botun yürüme hızı (birim/sn). Oyuncu 9 ile koşar; bot gezinir. */
export const BOT_HIZI = 3.2;

// Dolaşma halkası: çeşme (6.6) ile bankların iç kenarı (12.5 - 1.6)
// arası boş. Gövde payıyla birlikte bu aralıkta kalınır.
const HALKA_MIN = 8.2;
const HALKA_MAX = 9.8;
const GOVDE_R = 0.55;          // engelden uzak durma payı
const SAPMA_PAYI = 0.35;       // engelin etrafından dolaşırken ek boşluk
const KAPI_PAYI = 0.4;         // kapı noktası bina engelinin bu kadar önünde
const ADIM_ACI = (12 * Math.PI) / 180;

/**
 * Nöbetteki botlar. Zamanlar İSTEMCİ saatine çevrilir: sunucu saati ile
 * cihaz saati arasındaki fark düşülür. Hata olursa boş liste — meydan
 * botsuz kalır, sorun değil.
 * @returns {Promise<Array<{user_id:string, gorunen_ad:string, gorunum:object,
 *   tohum:string, baslangicMs:number, bitisMs:number}>>}
 */
export async function meydanBotlariniAl() {
  try {
    const { data, error } = await supabase.rpc("meydan_botlari");
    if (error) throw error;
    const simdi = Date.now();
    return (data ?? [])
      .map((b) => {
        const fark = Date.parse(b.sunucu_zamani) - simdi;
        const baslangicMs = Date.parse(b.baslangic) - (Number.isFinite(fark) ? fark : 0);
        const bitisMs = Date.parse(b.bitis) - (Number.isFinite(fark) ? fark : 0);
        return { ...b, baslangicMs, bitisMs };
      })
      .filter((b) => Number.isFinite(b.baslangicMs) && Number.isFinite(b.bitisMs));
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

/** Tohumdan kararlı rastgele sayı üreteci (mulberry32). */
function rastgeleUret(tohum) {
  let a = Math.floor(tohumSayi(tohum, "plan") * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bina kapılarının önündeki noktalar (bina engelinin hemen önü).
 * @param {Array<{x:number,z:number}>} binalar
 * @param {Array<{x:number,z:number,r:number}>} engeller
 */
export function kapilariHesapla(binalar, engeller) {
  const kapilar = [];
  for (const b of binalar ?? []) {
    const mesafe = Math.hypot(b.x, b.z);
    if (!(mesafe > 0)) continue;
    const e = (engeller ?? []).find((o) => Math.hypot(o.x - b.x, o.z - b.z) < 0.01);
    const r = e ? e.r : 6;
    const k = Math.max(0, mesafe - r - GOVDE_R - KAPI_PAYI) / mesafe;
    kapilar.push({ x: b.x * k, z: b.z * k, aci: Math.atan2(b.z, b.x) });
  }
  return kapilar;
}

/**
 * p → q düz yolunu engellere göre böler: çarpacağı ilk engelin yanına bir
 * ara nokta konur (engel merkezinden yola doğru, engel + gövde payı kadar
 * dışarıda). Döndürülen dizi q'yu içerir, p'yi içermez.
 */
function sapmaliYol(p, q, engeller, derinlik = 0) {
  const dx = q.x - p.x, dz = q.z - p.z;
  const uz2 = dx * dx + dz * dz;
  if (uz2 < 1e-6 || derinlik > 4) return [q];

  let ilk = null, ilkT = Infinity;
  for (const e of engeller) {
    const t = ((e.x - p.x) * dx + (e.z - p.z) * dz) / uz2;
    if (t <= 0 || t >= 1) continue;
    const cx = p.x + dx * t, cz = p.z + dz * t;
    const d = Math.hypot(cx - e.x, cz - e.z);
    if (d < e.r + GOVDE_R && t < ilkT) { ilk = { e, cx, cz, d }; ilkT = t; }
  }
  if (!ilk) return [q];

  const { e, cx, cz, d } = ilk;
  let nx, nz;
  if (d > 1e-3) { nx = (cx - e.x) / d; nz = (cz - e.z) / d; }
  else { const u = Math.sqrt(uz2); nx = -dz / u; nz = dx / u; }   // tam ortadan: sola
  const ara = { x: e.x + nx * (e.r + GOVDE_R + SAPMA_PAYI), z: e.z + nz * (e.r + GOVDE_R + SAPMA_PAYI) };
  return [...sapmaliYol(p, ara, engeller, derinlik + 1), ...sapmaliYol(ara, q, engeller, derinlik + 1)];
}

function uzunluk(bas, noktalar) {
  let t = 0, o = bas;
  for (const n of noktalar) { t += Math.hypot(n.x - o.x, n.z - o.z); o = n; }
  return t;
}

/** En kısa yönden açı farkı (-π..π). */
function aciFarki(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Halka üstünde, açısı ve yarıçapı yavaşça değişen yol (engel denetimli). */
function halkaYolu(bas, hedefAci, hedefR, engeller) {
  const a0 = Math.atan2(bas.z, bas.x), r0 = Math.hypot(bas.x, bas.z);
  const fark = hedefAci - a0;
  const adim = Math.max(1, Math.ceil(Math.abs(fark) / ADIM_ACI));
  const yol = [];
  let o = bas;
  for (let i = 1; i <= adim; i++) {
    const a = a0 + (fark * i) / adim, r = r0 + ((hedefR - r0) * i) / adim;
    const n = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    yol.push(...sapmaliYol(o, n, engeller));
    o = n;
  }
  return yol;
}

/** Bulunduğu yerden bir kapıya: halka boyunca kapının hizasına, sonra dışarı. */
function cikisYolu(bas, kapi, engeller) {
  const a0 = Math.atan2(bas.z, bas.x);
  const r0 = Math.min(HALKA_MAX, Math.max(HALKA_MIN, Math.hypot(bas.x, bas.z)));
  const hiza = halkaYolu(bas, a0 + aciFarki(a0, kapi.aci), r0, engeller);
  const son = hiza.length ? hiza[hiza.length - 1] : bas;
  return [...hiza, ...sapmaliYol(son, kapi, engeller)];
}

/**
 * Botun nöbet boyunca izleyeceği zaman damgalı yol.
 * Aynı girdi → aynı plan (tüm istemcilerde).
 * @returns {{noktalar:Array<{t:number,x:number,z:number,aci:number}>, bitisMs:number}}
 */
export function botPlaniKur({ tohum, baslangicMs, bitisMs, kapilar, engeller }) {
  const engel = engeller ?? [];
  const r = rastgeleUret(tohum);
  const hizMs = 1000 / BOT_HIZI;

  if (!kapilar?.length) {
    // Kapı bilgisi yoksa (harita değişti, bina yok): halkada durur.
    const a = r() * Math.PI * 2;
    const n = { t: baslangicMs, x: Math.cos(a) * HALKA_MIN, z: Math.sin(a) * HALKA_MIN, aci: 0 };
    return { noktalar: [n, { ...n, t: bitisMs }], bitisMs };
  }

  const giris = kapilar[Math.floor(r() * kapilar.length) % kapilar.length];
  let cikis = kapilar[Math.floor(r() * kapilar.length) % kapilar.length];
  if (cikis === giris && kapilar.length > 1) {
    cikis = kapilar[(kapilar.indexOf(giris) + 1 + Math.floor(r() * (kapilar.length - 1))) % kapilar.length];
  }

  const noktalar = [{ t: baslangicMs, x: giris.x, z: giris.z, aci: Math.atan2(-giris.x, -giris.z) }];
  const son = () => noktalar[noktalar.length - 1];
  const yuru = (yol, olcek = 1) => {
    for (const n of yol) {
      const o = son();
      const d = Math.hypot(n.x - o.x, n.z - o.z);
      if (d < 1e-4) continue;
      noktalar.push({ t: o.t + d * hizMs * olcek, x: n.x, z: n.z, aci: Math.atan2(n.x - o.x, n.z - o.z) });
    }
  };
  const bekle = (ms) => { if (ms > 0) { const o = son(); noktalar.push({ ...o, t: o.t + ms }); } };

  // 1) Kapıdan meydana
  const girisAci = Math.atan2(giris.z, giris.x);
  const girisR = HALKA_MIN + r() * (HALKA_MAX - HALKA_MIN);
  yuru(sapmaliYol(son(), { x: Math.cos(girisAci) * girisR, z: Math.sin(girisAci) * girisR }, engel));

  // 2) Dolaş — çıkışa yetecek süre kaldığı sürece
  for (let i = 0; i < 40; i++) {
    const o = son();
    const yon = r() < 0.5 ? -1 : 1;
    const aci = Math.atan2(o.z, o.x) + yon * ((35 + r() * 95) * Math.PI) / 180;
    const hedefR = HALKA_MIN + r() * (HALKA_MAX - HALKA_MIN);
    const bacak = halkaYolu(o, aci, hedefR, engel);
    const bacakMs = uzunluk(o, bacak) * hizMs;
    const molaMs = r() < 0.55 ? 2500 + r() * 6500 : 0;
    const varis = bacak.length ? bacak[bacak.length - 1] : o;
    const cikisMs = uzunluk(varis, cikisYolu(varis, cikis, engel)) * hizMs;
    if (o.t + bacakMs + molaMs + cikisMs > bitisMs) break;
    yuru(bacak);
    bekle(molaMs);
  }

  // 3) Binaya yürü; tam bitiş anında kapıda ol. Artan süre son bir
  //    bakınma molasıdır; süre yetmezse adımlar biraz hızlanır.
  const cikisYol = cikisYolu(son(), cikis, engel);
  const gerekenMs = uzunluk(son(), cikisYol) * hizMs;
  const kalanMs = bitisMs - son().t;
  if (kalanMs >= gerekenMs) {
    bekle(kalanMs - gerekenMs);
    yuru(cikisYol);
  } else {
    yuru(cikisYol, gerekenMs > 0 ? Math.max(0, kalanMs) / gerekenMs : 1);
  }
  return { noktalar, bitisMs };
}

/**
 * Planın verilen andaki durumu.
 * @returns {{x:number, z:number, aci:number, yuruyor:boolean, bitti:boolean}}
 */
export function planKonumu(plan, simdiMs) {
  const n = plan?.noktalar;
  if (!n?.length) return { x: 0, z: 0, aci: 0, yuruyor: false, bitti: true };
  if (simdiMs >= plan.bitisMs || simdiMs >= n[n.length - 1].t) {
    const s = n[n.length - 1];
    return { x: s.x, z: s.z, aci: s.aci, yuruyor: false, bitti: true };
  }
  if (simdiMs <= n[0].t) return { x: n[0].x, z: n[0].z, aci: n[0].aci, yuruyor: false, bitti: false };

  // İkili arama: simdiMs'yi içeren parça
  let lo = 0, hi = n.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (n[m].t <= simdiMs) lo = m; else hi = m;
  }
  const a = n[lo], b = n[hi];
  const f = b.t > a.t ? (simdiMs - a.t) / (b.t - a.t) : 1;
  const yuruyor = Math.hypot(b.x - a.x, b.z - a.z) > 1e-3;
  return {
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    aci: yuruyor ? b.aci : a.aci,
    yuruyor,
    bitti: false,
  };
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
