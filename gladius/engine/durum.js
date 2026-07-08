// ============================================================
// Oyun durumu ve güncelleme mantığı (yerel/otoriter-öncesi sürüm).
// Faz 2'de ağ senkronizasyonu (presence+broadcast), Faz 5'te kritik
// kontroller (hasar/eleme) sunucuya taşınacak.
// Şimdilik: hareket + bot gezinme + karakter/silah/kalkan görselleri.
// ============================================================

import {
  ARENA_YARICAP, ARENA_MERKEZ, OYUNCU_YARICAP, OYUNCU_HIZ, BOT_HIZ,
  CAN_MAX, BOT_YON_DEGISIM_MIN, BOT_YON_DEGISIM_MAX, YEREL_BOT_SAYISI,
  VURUS_COOLDOWN, VURUS_MESAFE, BOT_ARAMA_MENZIL, BOT_SALDIRI_CD_MIN, BOT_SALDIRI_CD_MAX, OLUM_BEKLE,
  MAYMUN_BASLA, BOGA_BASLA_SONRA, ASLAN_BASLA_SONRA, ASLAN_SURE_MAKS,
  ITEM_SPAWN_ARALIK, ITEM_MAKS, ITEM_TOPLAMA_MESAFE, CAN_ITEM_MIKTAR,
  HIZLANDIRMA_CARPAN, HIZLANDIRMA_SURE,
  ZIRH_ITEM_SURE, GUC_ITEM_SURE,
  ALTIN_DK_ARALIK_MIN, ALTIN_DK_ARALIK_MAX, ALTIN_DK_SURE,
  ALEV_ARALIK, ALEV_SURE, ALEV_YARICAP, ALEV_HASAR, HAZIR_SURE,
} from "../shared/denge.js";
import { GLADYATORLER, karakterBul } from "../shared/karakterler.js";
import { SILAHLAR, KALKANLAR, silahCizimTipi, kalkanCizimTipi } from "../shared/itemler.js";
import { VARSAYILAN_SECIM } from "../lib/secim.js";
import { vur, aciFarki } from "./dovus.js";
import {
  maymunlariBaslat, maymunlariGuncelle, bogaBaslat, bogaGuncelle,
  aslanlariBaslat, aslanlariGuncelle, atesBaslat, atesGuncelle,
  duelloBaslat, duelloGuncelle,
} from "./tehditler.js";

function rastgele(min, max) {
  return min + Math.random() * (max - min);
}

function rastgeleEleman(dizi) {
  return dizi[Math.floor(Math.random() * dizi.length)];
}

// Konumu arena dairesinin içinde tut.
function arenayaSikistir(e) {
  const dx = e.x - ARENA_MERKEZ.x;
  const dy = e.y - ARENA_MERKEZ.y;
  const uz = Math.hypot(dx, dy);
  const maks = ARENA_YARICAP - OYUNCU_YARICAP;
  if (uz > maks) {
    e.x = ARENA_MERKEZ.x + (dx / uz) * maks;
    e.y = ARENA_MERKEZ.y + (dy / uz) * maks;
    return true;
  }
  return false;
}

function rastgeleKonum() {
  const aci = Math.random() * Math.PI * 2;
  const r = rastgele(ARENA_YARICAP * 0.25, ARENA_YARICAP * 0.8);
  return { x: Math.cos(aci) * r, y: Math.sin(aci) * r };
}

// Bir bota rastgele karakter + silah + kalkan görseli ata.
function botGorsel() {
  const kar = rastgeleEleman(GLADYATORLER);
  const silahKat = rastgeleEleman(SILAHLAR);
  const silahVar = rastgeleEleman(silahKat.varyantlar);
  const kalkanVar = rastgeleEleman(KALKANLAR.varyantlar);
  return {
    id: kar.id,
    ad: kar.ad,
    palet: kar.palet,
    silahCizim: silahCizimTipi(silahKat.anahtar, silahVar.id),
    kalkanCizim: kalkanVar.cizim,
    kalkanRenk: kar.palet.zirh,
  };
}

export function createDurum({ mod = "battle_royale", oyuncuAd = "Sen", secim = VARSAYILAN_SECIM } = {}) {
  const oyuncular = [];
  // BR'de silah/kalkan başta PASİF (yerden toplanınca aktifleşir, tasarım 3.1).
  // Deathmatch'te başta aktif (tasarım 3.8).
  const brMod = mod === "battle_royale";

  // Gerçek oyuncu (0. indeks) — seçimine göre.
  const kar = karakterBul(secim.karakter);
  const pk = rastgeleKonum();
  oyuncular.push({
    id: "ben",
    ad: oyuncuAd,
    bot: false,
    x: pk.x, y: pk.y,
    aci: 0,
    can: CAN_MAX,
    karakterId: kar.id,
    palet: kar.palet,
    silahCizim: silahCizimTipi(secim.silah, secim.silahVaryant),
    kalkanCizim: kalkanCizimTipi(secim.kalkanVaryant),
    kalkanRenk: kar.palet.zirh,
    silahAktif: !brMod,       // BR: toplanınca aktif; DM: baştan aktif
    kalkanIzin: !brMod,       // kalkan kullanma izni (BR'de toplanınca)
    kalkanKalkik: false,
    saldiriCd: 0,
    sersem: 0,
    hizBoost: 0,
    zirhKalan: 0,
    gucKalan: 0,
    eleme: 0,
    aslanEleme: 0,
    _yon: 0,
    _yonZaman: 0,
  });

  // Botlar.
  for (let i = 0; i < YEREL_BOT_SAYISI; i++) {
    const g = botGorsel();
    const k = rastgeleKonum();
    oyuncular.push({
      id: `bot${i}`,
      ad: g.ad,
      bot: true,
      x: k.x, y: k.y,
      aci: Math.random() * Math.PI * 2,
      can: CAN_MAX,
      karakterId: g.id,
      palet: g.palet,
      silahCizim: g.silahCizim,
      kalkanCizim: g.kalkanCizim,
      kalkanRenk: g.kalkanRenk,
      silahAktif: !brMod,
      kalkanIzin: !brMod,
      kalkanKalkik: false,
      saldiriCd: rastgele(BOT_SALDIRI_CD_MIN, BOT_SALDIRI_CD_MAX),
      sersem: 0,
      hizBoost: 0,
      zirhKalan: 0,
      gucKalan: 0,
      eleme: 0,
      aslanEleme: 0,
      _yon: Math.random() * Math.PI * 2,
      _yonZaman: rastgele(BOT_YON_DEGISIM_MIN, BOT_YON_DEGISIM_MAX),
    });
  }

  return {
    mod, oyuncular, zaman: 0, efektler: [], kanlar: [], sesler: ["borazan"],
    itemler: [], _itemSayaci: 2, killFeed: [],
    // Deathmatch ekstraları (tasarım 3.8.1)
    altinDakika: false, altinKalan: 0,
    _altinSayaci: rastgele(ALTIN_DK_ARALIK_MIN, ALTIN_DK_ARALIK_MAX),
    alevler: [], _alevSayaci: ALEV_ARALIK,
    bitti: false, kazanan: null, _bitisSayaci: 0,
    // İstatistik/rozet izleme (tasarım 2.1)
    ilkKanId: null, _olumSayaci: 0,
    // Başlangıç "hazır" fazı (borazan + tema metni), sonra pvp.
    hazirKalan: HAZIR_SURE,
    // Faz durum makinesi (tasarım 3.1 sıralama). Round "hazir" ile başlar.
    faz: "hazir", pvpAcik: true, tehditler: [],
    maymunYapildi: false, bogaYapildi: false, aslanYapildi: false,
    _maymunBittiZaman: 0, _bogaBittiZaman: 0, _aslanZaman: 0,
    atesAktif: false, atesYaricap: 0, atesZaman: 0,
  };
}

// Faz zaman çizelgesi (tasarım 3.1):
// pvp → maymun → pvp → boğa → pvp → aslan (daralma) → ateş çemberi (kesin bitiş).
// (Gladyatör Düellosu sonraki adımda aslan ile ateş arasına eklenecek.)
function fazKontrol(durum, dt) {
  if (durum.faz === "maymun") {
    if (maymunlariGuncelle(durum, dt)) {
      durum.faz = "pvp"; durum.pvpAcik = true;
      durum.maymunYapildi = true; durum._maymunBittiZaman = durum.zaman;
    }
    return;
  }
  if (durum.faz === "boga") {
    if (bogaGuncelle(durum, dt)) {
      durum.faz = "pvp"; durum.pvpAcik = true;
      durum.bogaYapildi = true; durum._bogaBittiZaman = durum.zaman;
    }
    return;
  }
  if (durum.faz === "aslan") {
    durum._aslanZaman += dt;
    const bitti = aslanlariGuncelle(durum, dt);
    // Aslanlar ölünce VEYA süre dolunca Gladyatör Düellosu (tasarım 3.3.2).
    if (bitti || durum._aslanZaman >= ASLAN_SURE_MAKS) {
      durum.aslanYapildi = true;
      // Düello için en az 2 kişi gerek; yoksa doğrudan Ateş Çemberi.
      if (durum.oyuncular.filter((o) => o.can > 0).length >= 2) { duelloBaslat(durum); durum.sesler?.push("borazan"); }
      else atesBaslat(durum);
    }
    return;
  }
  if (durum.faz === "duello") {
    if (duelloGuncelle(durum, dt)) atesBaslat(durum);
    return;
  }
  if (durum.faz === "ates") {
    atesGuncelle(durum, dt);
    return;
  }
  // pvp: sıradaki tehdidi zamanı gelince başlat
  if (!durum.maymunYapildi && durum.zaman >= MAYMUN_BASLA) {
    maymunlariBaslat(durum); durum.sesler?.push("borazan");
  } else if (durum.maymunYapildi && !durum.bogaYapildi &&
             durum._maymunBittiZaman > 0 && (durum.zaman - durum._maymunBittiZaman) >= BOGA_BASLA_SONRA) {
    bogaBaslat(durum); durum.sesler?.push("borazan");
  } else if (durum.bogaYapildi && !durum.aslanYapildi &&
             durum._bogaBittiZaman > 0 && (durum.zaman - durum._bogaBittiZaman) >= ASLAN_BASLA_SONRA) {
    aslanlariBaslat(durum); durum.sesler?.push("borazan");
  }
}

// Moda göre rastgele item tipi seç.
function itemTipiSec(durum) {
  const r = Math.random();
  if (durum.mod === "battle_royale") {
    // BR: silah/kalkan (aktivasyon) + can/hız
    if (r < 0.3) return "silah";
    if (r < 0.5) return "kalkan";
    if (r < 0.8) return "can";
    return "hiz";
  }
  // Deathmatch: can/hız + zırh/güç (tasarım 3.8.1)
  if (r < 0.4) return "can";
  if (r < 0.6) return "hiz";
  if (r < 0.82) return "zirh";
  return "guc";
}

// Itemler: periyodik spawn + toplama (tasarım 3.1, 3.8.1).
function itemGuncelle(durum, dt) {
  durum._itemSayaci -= dt;
  if (durum._itemSayaci <= 0 && durum.itemler.length < ITEM_MAKS) {
    durum._itemSayaci = ITEM_SPAWN_ARALIK;
    const aci = Math.random() * Math.PI * 2;
    const r = Math.random() * (ARENA_YARICAP * 0.8);
    durum.itemler.push({
      tip: itemTipiSec(durum),
      x: ARENA_MERKEZ.x + Math.cos(aci) * r,
      y: ARENA_MERKEZ.y + Math.sin(aci) * r,
    });
  }
  // Toplama
  durum.itemler = durum.itemler.filter((it) => {
    for (const o of durum.oyuncular) {
      if (o.can <= 0) continue;
      if (Math.hypot(o.x - it.x, o.y - it.y) < ITEM_TOPLAMA_MESAFE) {
        switch (it.tip) {
          case "can": o.can = Math.min(CAN_MAX, o.can + CAN_ITEM_MIKTAR); break;
          case "hiz": o.hizBoost = HIZLANDIRMA_SURE; break;
          case "silah": o.silahAktif = true; break;   // BR: silahı aktifleştir
          case "kalkan": o.kalkanIzin = true; break;   // BR: kalkanı aktifleştir
          case "zirh": o.zirhKalan = ZIRH_ITEM_SURE; break; // DM
          case "guc": o.gucKalan = GUC_ITEM_SURE; break;    // DM
          default: break;
        }
        durum.sesler?.push("item");
        return false; // toplandı, kaldır
      }
    }
    return true;
  });
}

// Deathmatch ekstraları: Altın Dakika (çift hasar) + Rastgele Alev Püskürmesi (tasarım 3.8.1).
function deathmatchEkstra(durum, dt) {
  // Altın Dakika
  if (durum.altinDakika) {
    durum.altinKalan -= dt;
    if (durum.altinKalan <= 0) {
      durum.altinDakika = false;
      durum._altinSayaci = rastgele(ALTIN_DK_ARALIK_MIN, ALTIN_DK_ARALIK_MAX);
    }
  } else {
    durum._altinSayaci -= dt;
    if (durum._altinSayaci <= 0) {
      durum.altinDakika = true;
      durum.altinKalan = ALTIN_DK_SURE;
    }
  }

  // Rastgele alev püskürmesi
  durum._alevSayaci -= dt;
  if (durum._alevSayaci <= 0) {
    durum._alevSayaci = ALEV_ARALIK + rastgele(0, 3);
    const aci = Math.random() * Math.PI * 2;
    const r = ARENA_YARICAP * (0.55 + Math.random() * 0.3);
    durum.alevler.push({ x: ARENA_MERKEZ.x + Math.cos(aci) * r, y: ARENA_MERKEZ.y + Math.sin(aci) * r, t: 0 });
  }
  for (const al of durum.alevler) {
    al.t += dt;
    for (const o of durum.oyuncular) {
      if (o.can <= 0) continue;
      if (Math.hypot(o.x - al.x, o.y - al.y) < ALEV_YARICAP) {
        o.can -= ALEV_HASAR * dt;
        if (o.can <= 0) {
          o.can = 0; o.oldu = true;
          durum.kanlar.push({ x: o.x, y: o.y, r: 24 + Math.random() * 12, aci: Math.random() * Math.PI * 2 });
        }
      }
    }
  }
  durum.alevler = durum.alevler.filter((al) => al.t < ALEV_SURE);
}

// Verilen listede e'ye en yakın hayattaki hedefi bul (menzil içinde).
function enYakinHedef(e, liste, menzil) {
  let hedef = null;
  let enYakin = menzil;
  for (const t of liste) {
    if (t === e || t.can <= 0) continue;
    const uz = Math.hypot(t.x - e.x, t.y - e.y);
    if (uz < enYakin) {
      enYakin = uz;
      hedef = t;
    }
  }
  return hedef;
}

export function guncelle(durum, dt, girdi) {
  durum.zaman += dt;

  // Başlangıç "hazır" fazı: borazan çalar, tema metni gösterilir, dövüş henüz başlamaz.
  if (durum.faz === "hazir") {
    durum.hazirKalan -= dt;
    if (durum.hazirKalan <= 0) {
      durum.faz = "pvp";
      durum.zaman = 0;              // asıl round süresi hazır bitince başlar
      durum.sesler?.push("borazan");
    }
    return;
  }

  // Faz/tehdit güncellemesi yalnızca Battle Royale modunda (Deathmatch tehditsiz — tasarım 3.8).
  if (durum.mod === "battle_royale") fazKontrol(durum, dt);

  // Item spawn/toplama (her iki modda).
  itemGuncelle(durum, dt);

  // Deathmatch ekstraları.
  if (durum.mod === "deathmatch") deathmatchEkstra(durum, dt);

  for (const e of durum.oyuncular) {
    if (e.can <= 0) continue;
    e.saldiriCd = Math.max(0, e.saldiriCd - dt);
    if (e.hizBoost > 0) e.hizBoost = Math.max(0, e.hizBoost - dt);
    if (e.zirhKalan > 0) e.zirhKalan = Math.max(0, e.zirhKalan - dt);
    if (e.gucKalan > 0) e.gucKalan = Math.max(0, e.gucKalan - dt);

    // Sersemleme (boğa çarpması): kontrol kapalı.
    if (e.sersem > 0) {
      e.sersem = Math.max(0, e.sersem - dt);
      arenayaSikistir(e);
      continue;
    }

    const carpan = e.hizBoost > 0 ? HIZLANDIRMA_CARPAN : 1;

    if (e.bot) {
      const botHiz = BOT_HIZ * carpan;
      // Ortak-tehdit fazında tehditlere, düelloda rakip takıma, normalde oyunculara yönel.
      let hedefListe = durum.pvpAcik ? durum.oyuncular : durum.tehditler;
      if (durum.faz === "duello") hedefListe = durum.oyuncular.filter((o) => o.takim && o.takim !== e.takim);
      const hedef = enYakinHedef(e, hedefListe, durum.faz === "duello" ? 9999 : BOT_ARAMA_MENZIL);
      if (hedef) {
        // Hedefe yönel + yaklaş; menzildeyse ve açı tutuyorsa vur.
        const dx = hedef.x - e.x, dy = hedef.y - e.y;
        const uz = Math.hypot(dx, dy);
        e.aci = Math.atan2(dy, dx);
        if (uz > VURUS_MESAFE * 0.85) {
          e.x += (dx / uz) * botHiz * dt;
          e.y += (dy / uz) * botHiz * dt;
        } else if (e.saldiriCd <= 0 && e.silahAktif) {
          vur(durum, e);
          e.saldiriCd = rastgele(BOT_SALDIRI_CD_MIN, BOT_SALDIRI_CD_MAX);
        }
      } else {
        // Gezinme
        e._yonZaman -= dt;
        if (e._yonZaman <= 0) {
          e._yon = Math.random() * Math.PI * 2;
          e._yonZaman = rastgele(BOT_YON_DEGISIM_MIN, BOT_YON_DEGISIM_MAX);
        }
        e.x += Math.cos(e._yon) * botHiz * dt;
        e.y += Math.sin(e._yon) * botHiz * dt;
        e.aci = e._yon;
      }
      if (arenayaSikistir(e)) {
        e._yon = Math.atan2(ARENA_MERKEZ.y - e.y, ARENA_MERKEZ.x - e.x);
      }
    } else {
      // Gerçek oyuncu
      e.kalkanKalkik = girdi.kalkanBasiliMi() && e.kalkanIzin;
      const oyHiz = OYUNCU_HIZ * carpan;
      const v = girdi.hareketVektoru();
      if (v.x !== 0 || v.y !== 0) {
        e.x += v.x * oyHiz * dt;
        e.y += v.y * oyHiz * dt;
        e.aci = Math.atan2(v.y, v.x);
      }
      arenayaSikistir(e);
      if (girdi.saldiriAl() && e.saldiriCd <= 0 && e.silahAktif) {
        vur(durum, e);
        e.saldiriCd = VURUS_COOLDOWN;
      }
    }
  }

  // Geçici efektleri yaşlandır.
  for (const f of durum.efektler) f.t += dt;
  durum.efektler = durum.efektler.filter((f) => f.t < f.sure);

  // Kill feed yaşlandır.
  for (const kf of durum.killFeed) kf.t += dt;
  durum.killFeed = durum.killFeed.filter((kf) => kf.t < kf.sure);

  // Merkezi ölüm kaydı: ölüm sırası + zamanı (kaynak fark etmez — PvP/tehdit/ateş).
  // "Son Nefes" (en son elenen) ve hayatta kalma süresi rozetleri için.
  for (const o of durum.oyuncular) {
    if (o.can <= 0 && o.olumSira === undefined) {
      o.olumSira = ++durum._olumSayaci;
      o.olumZaman = durum.zaman;
    }
  }

  // Round sonu (tasarım 3.6.1): tek kişi kalınca (yalnızca PvP fazında) VEYA herkes
  // ölünce (her fazda — soft-lock önleme) kısa bekleme sonrası sonuç ilan edilir.
  if (!durum.bitti) {
    const hayatta = durum.oyuncular.filter((o) => o.can > 0);
    // Düelloda "tek kişi kaldı" ile round bitmesin (düello kendi eşiğiyle biter).
    const bitisKosulu = hayatta.length === 0 ||
      (hayatta.length === 1 && durum.pvpAcik && durum.faz !== "duello");
    if (bitisKosulu) {
      durum._bitisSayaci += dt;
      if (durum._bitisSayaci >= OLUM_BEKLE) {
        durum.bitti = true;
        durum.kazanan = hayatta.length === 1 ? hayatta[0] : null; // 0 => kazanan yok
      }
    } else {
      durum._bitisSayaci = 0;
    }
  }
}
