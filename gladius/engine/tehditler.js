// ============================================================
// Ortak-tehdit fazları (tasarım 3.3 Maymun İstilası, 3.3.1 Boğa Hücumu).
// Bu fazlarda PvP kapanır (durum.pvpAcik=false), herkesin vuruşu tehdide gider.
// Tehditler oyunculara hasar verir; kalkan basılıysa %70-80 azaltır.
// ============================================================

import {
  ARENA_YARICAP, ARENA_MERKEZ, OYUNCU_YARICAP, CAN_MAX,
  MAYMUN_SAYISI, MAYMUN_CAN, MAYMUN_HASAR, MAYMUN_HIZ, MAYMUN_VURUS_CD, MAYMUN_HEDEF_DEGISIM,
  BOGA_CAN, BOGA_HASAR, BOGA_SERSEM, BOGA_SARJ_HIZ, BOGA_YURU_HIZ, BOGA_VURUS_MESAFE, BOGA_YAKIN_CEZA_MESAFE,
  ASLAN_SAYISI, ASLAN_CAN, ASLAN_HASAR, ASLAN_ATILMA_HIZ, ASLAN_DEVRIYE_HIZ,
  ASLAN_BOLGE_BASLANGIC, ASLAN_BOLGE_BUYUME, ASLAN_VURUS_CD,
  ATES_DARALMA_BASLANGIC, ATES_DARALMA_ARTIS, ATES_HASAR_BASLANGIC, ATES_HASAR_ARTIS,
} from "../shared/denge.js";

function hayattaOyuncular(durum) {
  return durum.oyuncular.filter((o) => o.can > 0);
}

// Bir oyuncuya tehdit hasarı (kalkan azaltmalı). Ölürse ceset/kan bırakır.
function tehditHasar(durum, hedef, hasar, aci) {
  if (hedef.can <= 0) return;
  if (hedef.kalkanKalkik) hasar *= (1 - (0.70 + Math.random() * 0.10)); // %70-80
  hedef.can -= hasar;
  durum.efektler.push({ tip: "kan", x: hedef.x, y: hedef.y, aci: aci ?? 0, t: 0, sure: 0.35 });
  if (hedef.can <= 0) {
    hedef.can = 0;
    hedef.oldu = true;
    if (!hedef.tehdit) {
      durum.kanlar.push({ x: hedef.x, y: hedef.y, r: 24 + Math.random() * 12, aci: Math.random() * Math.PI * 2 });
    }
  }
}

// ---------- MAYMUN İSTİLASI ----------

export function maymunlariBaslat(durum) {
  durum.faz = "maymun";
  durum.pvpAcik = false;
  durum.tehditler = [];
  const kenar = ARENA_YARICAP - 30;
  const yonler = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // 4 taraf
  for (let i = 0; i < MAYMUN_SAYISI; i++) {
    const y = yonler[i % 4] + (Math.random() - 0.5) * 0.4;
    durum.tehditler.push({
      tehdit: true, tip: "maymun",
      x: ARENA_MERKEZ.x + Math.cos(y) * kenar,
      y: ARENA_MERKEZ.y + Math.sin(y) * kenar,
      aci: y + Math.PI,
      can: MAYMUN_CAN,
      hedefId: null, vurus: 0, vurusCd: Math.random() * 0.5,
    });
  }
}

export function maymunlariGuncelle(durum, dt) {
  const canlilar = hayattaOyuncular(durum);
  for (const m of durum.tehditler) {
    if (m.can <= 0) continue;
    m.vurusCd -= dt;

    // Hedef seç: yoksa/öldüyse en yakın canlı oyuncu.
    let hedef = canlilar.find((o) => o.id === m.hedefId && o.can > 0);
    if (!hedef && canlilar.length) {
      hedef = enYakinCanli(m, canlilar);
      m.hedefId = hedef ? hedef.id : null;
      m.vurus = 0;
    }
    if (!hedef) continue;

    const dx = hedef.x - m.x, dy = hedef.y - m.y;
    const uz = Math.hypot(dx, dy);
    m.aci = Math.atan2(dy, dx);
    const temas = OYUNCU_YARICAP + 20;
    if (uz > temas) {
      // Rastgele zıplama hissi için hafif salınım
      const salinim = Math.sin(durum.zaman * 12 + m.x) * 0.25;
      m.x += Math.cos(m.aci + salinim) * MAYMUN_HIZ * dt;
      m.y += Math.sin(m.aci + salinim) * MAYMUN_HIZ * dt;
    } else if (m.vurusCd <= 0) {
      tehditHasar(durum, hedef, MAYMUN_HASAR, m.aci);
      m.vurusCd = MAYMUN_VURUS_CD;
      m.vurus++;
      if (m.vurus >= MAYMUN_HEDEF_DEGISIM) {
        // Başka en yakın oyuncuya geç (tasarım 3.3)
        const diger = enYakinCanli(m, canlilar.filter((o) => o.id !== m.hedefId));
        if (diger) { m.hedefId = diger.id; m.vurus = 0; }
      }
    }
  }
  // Ölenleri temizle
  durum.tehditler = durum.tehditler.filter((m) => m.can > 0);
  // Tüm maymunlar ölünce faz biter
  return durum.tehditler.length === 0;
}

function enYakinCanli(kaynak, liste) {
  let en = null, enUz = Infinity;
  for (const o of liste) {
    if (o.can <= 0) continue;
    const uz = Math.hypot(o.x - kaynak.x, o.y - kaynak.y);
    if (uz < enUz) { enUz = uz; en = o; }
  }
  return en;
}

// ---------- BOĞA HÜCUMU ----------

export function bogaBaslat(durum) {
  durum.faz = "boga";
  durum.pvpAcik = false;
  const kapiAci = Math.PI; // sol kapıdan girer
  durum.tehditler = [{
    tehdit: true, tip: "boga",
    x: ARENA_MERKEZ.x + Math.cos(kapiAci) * (ARENA_YARICAP - 20),
    y: ARENA_MERKEZ.y + Math.sin(kapiAci) * (ARENA_YARICAP - 20),
    aci: 0,
    can: BOGA_CAN,
    hal: "duraklama", halZaman: 0.8,
    sx: 0, sy: 0,
  }];
}

export function bogaGuncelle(durum, dt) {
  const boga = durum.tehditler[0];
  if (!boga || boga.can <= 0) return true;
  const canlilar = hayattaOyuncular(durum);
  if (!canlilar.length) return false;

  if (boga.hal === "duraklama") {
    boga.halZaman -= dt;
    // Yavaşça en yakın hedefe dön
    const h = enYakinCanli(boga, canlilar);
    if (h) boga.aci = Math.atan2(h.y - boga.y, h.x - boga.x);
    // Çok dibinde biri varsa ani ceza vuruşu (tasarım 3.3.1)
    if (h && Math.hypot(h.x - boga.x, h.y - boga.y) < BOGA_YAKIN_CEZA_MESAFE) {
      bogaVur(durum, boga, h);
      boga.halZaman = 0.6;
    }
    if (boga.halZaman <= 0 && h) {
      // Şarj yönünü sabitle
      boga.sx = Math.cos(boga.aci);
      boga.sy = Math.sin(boga.aci);
      boga.hal = "sarj";
      boga.sarjMesafe = 0;
    }
  } else if (boga.hal === "sarj") {
    const adim = BOGA_SARJ_HIZ * dt;
    boga.x += boga.sx * adim;
    boga.y += boga.sy * adim;
    boga.sarjMesafe = (boga.sarjMesafe || 0) + adim;
    // Yol üstündeki oyuncuya çarpma
    for (const o of canlilar) {
      if (Math.hypot(o.x - boga.x, o.y - boga.y) < BOGA_VURUS_MESAFE) {
        bogaVur(durum, boga, o);
        boga.hal = "duraklama"; boga.halZaman = 1.0;
        break;
      }
    }
    // Arena kenarına/uzağa varınca duraklama
    const merkezUz = Math.hypot(boga.x - ARENA_MERKEZ.x, boga.y - ARENA_MERKEZ.y);
    if (merkezUz > ARENA_YARICAP - 40 || boga.sarjMesafe > ARENA_YARICAP * 1.4) {
      boga.hal = "duraklama"; boga.halZaman = 1.0;
    }
  }

  // Ölürse faz biter
  if (boga.can <= 0) {
    durum.tehditler = [];
    return true;
  }
  return false;
}

function bogaVur(durum, boga, oyuncu) {
  tehditHasar(durum, oyuncu, BOGA_HASAR, boga.aci);
  // Havaya savrulma + sersemleme (tasarım 3.3.1)
  oyuncu.sersem = BOGA_SERSEM;
  const it = 40;
  oyuncu.x += boga.sx * it;
  oyuncu.y += boga.sy * it;
}

// ---------- ZİNCİRLİ ASLANLAR (tasarım 3.1) ----------
// PvP açık kalır (oyuncular hem birbirine hem aslana vurabilir). Aslanların bölgesi
// zamanla büyür → güvenli alan daralır. Bölgeye giren oyuncuya hızlı atılırlar.

export function aslanlariBaslat(durum) {
  durum.faz = "aslan";
  durum.pvpAcik = true;
  durum.tehditler = [];
  for (let i = 0; i < ASLAN_SAYISI; i++) {
    const aci = (i / ASLAN_SAYISI) * Math.PI * 2 + 0.4;
    const bazUz = ARENA_YARICAP * 0.62;
    const bx = ARENA_MERKEZ.x + Math.cos(aci) * bazUz;
    const by = ARENA_MERKEZ.y + Math.sin(aci) * bazUz;
    durum.tehditler.push({
      tehdit: true, tip: "aslan",
      x: bx, y: by, aci,
      bx, by, bolge: ASLAN_BOLGE_BASLANGIC,
      can: ASLAN_CAN, vurusCd: 0,
      hedef: null, devriyeAci: Math.random() * Math.PI * 2,
    });
  }
}

export function aslanlariGuncelle(durum, dt) {
  const canlilar = hayattaOyuncular(durum);
  for (const a of durum.tehditler) {
    if (a.can <= 0) continue;
    a.vurusCd -= dt;
    a.bolge += ASLAN_BOLGE_BUYUME * dt; // alan daralması (tasarım 3.1)

    // Bölgesine giren en yakın oyuncu?
    let av = null, avUz = Infinity;
    for (const o of canlilar) {
      const uz = Math.hypot(o.x - a.bx, o.y - a.by);
      if (uz <= a.bolge && uz < avUz) { avUz = uz; av = o; }
    }

    if (av) {
      // Hızlı atılma + saldırı
      const dx = av.x - a.x, dy = av.y - a.y;
      const uz = Math.hypot(dx, dy) || 1;
      a.aci = Math.atan2(dy, dx);
      if (uz > OYUNCU_YARICAP + 24) {
        a.x += (dx / uz) * ASLAN_ATILMA_HIZ * dt;
        a.y += (dy / uz) * ASLAN_ATILMA_HIZ * dt;
      } else if (a.vurusCd <= 0) {
        // Aslan pençesi: aktif kalkanı kırar + can azaltır (tasarım 3.1)
        if (av.kalkanKalkik) av.kalkanKalkik = false;
        tehditHasar(durum, av, ASLAN_HASAR, a.aci);
        a.vurusCd = ASLAN_VURUS_CD;
      }
    } else {
      // Bölge içinde devriye
      a.devriyeAci += (Math.random() - 0.5) * dt * 2;
      a.x += Math.cos(a.devriyeAci) * ASLAN_DEVRIYE_HIZ * dt;
      a.y += Math.sin(a.devriyeAci) * ASLAN_DEVRIYE_HIZ * dt;
      // Baz noktadan bölge dışına taşmasın
      const bdx = a.x - a.bx, bdy = a.y - a.by;
      const buz = Math.hypot(bdx, bdy);
      if (buz > a.bolge) {
        a.x = a.bx + (bdx / buz) * a.bolge;
        a.y = a.by + (bdy / buz) * a.bolge;
        a.devriyeAci += Math.PI;
      }
      a.aci = a.devriyeAci;
    }
  }
  durum.tehditler = durum.tehditler.filter((a) => a.can > 0);
  return durum.tehditler.length === 0; // hepsi ölünce faz biter
}

// ---------- GLADYATÖR DÜELLOSU (tasarım 3.3.2) ----------
// Aslanlardan sonra, Ateş Çemberi'nden önce: hayatta kalanlar iki takıma bölünür,
// ortada dövüşür. Belirli ölüm sayısına ulaşınca biter. Takım arkadaşına vurulmaz.

export function duelloBaslat(durum) {
  durum.faz = "duello";
  durum.pvpAcik = true;
  durum.tehditler = [];
  const canlilar = hayattaOyuncular(durum);
  // Dönüşümlü iki takım (a / b)
  canlilar.forEach((o, i) => { o.takim = i % 2 === 0 ? "a" : "b"; });
  const takimBoyu = Math.ceil(canlilar.length / 2);
  // 1-3 kişilik takımlarda 1 ölüm, 4-5'te 2 ölüm yeter (tasarım 3.3.2).
  durum.duelloEsik = takimBoyu <= 3 ? 1 : 2;
  durum.duelloBaslangic = canlilar.length;
  // Takımları arenanın ortasında iki yana diz
  let ai = 0, bi = 0;
  for (const o of canlilar) {
    if (o.takim === "a") { o.x = -140; o.y = (ai - (takimBoyu - 1) / 2) * 70; ai++; o.aci = 0; }
    else { o.x = 140; o.y = (bi - (takimBoyu - 1) / 2) * 70; bi++; o.aci = Math.PI; }
  }
}

export function duelloGuncelle(durum, dt) {
  const canlilar = hayattaOyuncular(durum).filter((o) => o.takim);
  const olumler = durum.duelloBaslangic - canlilar.length;
  let a = 0, b = 0;
  for (const o of canlilar) { if (o.takim === "a") a++; else b++; }
  if (olumler >= durum.duelloEsik || a === 0 || b === 0) {
    durum.oyuncular.forEach((o) => { o.takim = null; }); // etiketleri temizle
    return true;
  }
  return false;
}

// ---------- ATEŞ ÇEMBERİ (tasarım 3.1) ----------
// Dış kenar içeri doğru yanar; yanan bölgedeki oyuncuların canı zamanla artan
// hızda erir → round'un kaçınılmaz bitişini garantiler.

export function atesBaslat(durum) {
  durum.faz = "ates";
  durum.pvpAcik = true;
  durum.tehditler = [];
  durum.atesAktif = true;
  durum.atesYaricap = ARENA_YARICAP;
  durum.atesZaman = 0;
}

export function atesGuncelle(durum, dt) {
  durum.atesZaman += dt;
  const daralma = ATES_DARALMA_BASLANGIC + ATES_DARALMA_ARTIS * durum.atesZaman;
  durum.atesYaricap = Math.max(0, durum.atesYaricap - daralma * dt);
  const hasar = ATES_HASAR_BASLANGIC + ATES_HASAR_ARTIS * durum.atesZaman;

  for (const o of durum.oyuncular) {
    if (o.can <= 0) continue;
    const uz = Math.hypot(o.x - ARENA_MERKEZ.x, o.y - ARENA_MERKEZ.y);
    if (uz > durum.atesYaricap) {
      tehditHasar(durum, o, hasar * dt, o.aci + Math.PI);
    }
  }
}
