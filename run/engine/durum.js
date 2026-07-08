// ============================================================
// RUN — oyun durumu ve güncelleme (prototip, tek-oyunculu + bot + tek drone).
// Çekirdek döngü: karanlık labirentte fenerle gez, drone'dan kaç, çıkışa ulaş.
// Yakalanma = izleyici (oyuncu yakalanınca round biter). Beceriler sonraki turda.
// ============================================================

import {
  DUNYA, OYUNCU_HIZ, OYUNCU_YARICAP, BOT_SAYISI, BOT_HIZ,
  ISIK_DEGISIM_ARALIK, DRONE_DEVRIYE_HIZ, DRONE_KOVALA_HIZ, DRONE_GORUS,
  HEAT_YARICAP, HEAT_SURE, YAKALA_YARICAP, KAYIP_SURE, BOT_GRUP_MENZIL, DRONE_SAYISI,
} from "./sabitler.js";
import { OFIS, yurunebilir, cikistaMi, odaAdi } from "./harita.js";

const BOT_ADLARI = ["Neo", "Trinity", "Ghost", "Vega", "Kilo", "Rook", "Delta"];

function rastgele(min, max) { return min + Math.random() * (max - min); }

// Haritada rastgele yürünebilir bir nokta (odalardan birinin içinden).
function rastgeleNokta(harita) {
  for (let d = 0; d < 40; d++) {
    const a = harita.alanlar[Math.floor(Math.random() * harita.alanlar.length)];
    const x = a.x + Math.random() * a.w, y = a.y + Math.random() * a.h;
    if (yurunebilir(harita, x, y)) return { x, y };
  }
  return { ...harita.baslangic };
}

// Başlangıca yakın yürünebilir bir nokta (botlar oyuncunun yanında başlasın → görünür).
function baslangicYakini(harita) {
  for (let d = 0; d < 60; d++) {
    const a = rastgele(0, Math.PI * 2), r = rastgele(40, 340);
    const x = harita.baslangic.x + Math.cos(a) * r, y = harita.baslangic.y + Math.sin(a) * r;
    if (yurunebilir(harita, x, y)) return { x, y };
  }
  return { ...harita.baslangic };
}

// Eksen bazlı hareket + duvar kayması (yürünemeyen noktaya girmeyi engeller).
function hareketEt(harita, e, vx, vy) {
  if (yurunebilir(harita, e.x + vx, e.y)) e.x += vx;
  if (yurunebilir(harita, e.x, e.y + vy)) e.y += vy;
}

// Nokta aydınlık bir alanda mı (ışıklı oda)?
function aydinliktaMi(harita, x, y) {
  for (const a of harita.alanlar) {
    if (a.aydinlik && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true;
  }
  return false;
}

export function createDurum() {
  const harita = JSON.parse(JSON.stringify(OFIS)); // kopya (ışık durumu değişecek)
  const oyuncular = [];

  oyuncular.push({
    id: "ben", ad: "Sen", bot: false,
    x: harita.baslangic.x, y: harita.baslangic.y, aci: -Math.PI / 2,
    yakalandi: false, durgun: 0, _yon: 0, _yonZaman: 0,
  });

  const adlar = [...BOT_ADLARI].sort(() => Math.random() - 0.5);
  for (let i = 0; i < BOT_SAYISI; i++) {
    const k = baslangicYakini(harita);
    oyuncular.push({
      id: `bot${i}`, ad: adlar[i % adlar.length], bot: true,
      x: k.x, y: k.y, aci: Math.random() * Math.PI * 2,
      yakalandi: false, durgun: 0,
      _yon: Math.random() * Math.PI * 2, _yonZaman: rastgele(0.6, 2),
    });
  }

  const droneler = [];
  for (let i = 0; i < DRONE_SAYISI; i++) {
    const dk = rastgeleNokta(harita);
    droneler.push({ x: dk.x, y: dk.y, aci: 0, mod: "devriye", hedefId: null, hedefX: dk.x, hedefY: dk.y, kayip: 0 });
  }

  return {
    harita, oyuncular, droneler,
    zaman: 0, isikSayaci: ISIK_DEGISIM_ARALIK,
    bitti: false, sonuc: null,   // 'kacti' | 'yakalandi'
    genelBakis: false,           // GENEL BAKIŞ (uzaklaştırılmış test kamerası)
    kamera: { x: harita.baslangic.x, y: harita.baslangic.y },
    sesler: [],                  // ses olay kuyruğu (motor boşaltır)
  };
}

// Bir hayatta kalan, verilen drone tarafından algılanabilir mi?
function algilanabilir(durum, s, d) {
  if (s.yakalandi) return false;
  const uz = Math.hypot(s.x - d.x, s.y - d.y);
  // Aydınlıkta: GPS ile geniş menzilde görülür
  if (uz < DRONE_GORUS && aydinliktaMi(durum.harita, s.x, s.y)) return true;
  // Karanlıkta hareketsiz: ısı ile yakın menzilde
  if (uz < HEAT_YARICAP && s.durgun >= HEAT_SURE) return true;
  return false;
}

export function guncelle(durum, dt, girdi) {
  if (durum.bitti) return;
  durum.zaman += dt;

  // Işık/karanlık değişimi: periyodik olarak aydınlık odaları karıştır (tasarım 5)
  durum.isikSayaci -= dt;
  if (durum.isikSayaci <= 0) {
    durum.isikSayaci = ISIK_DEGISIM_ARALIK;
    const adliOdalar = durum.harita.alanlar.filter((a) => a.ad);
    for (const a of adliOdalar) a.aydinlik = Math.random() < 0.4;
  }

  // Hayatta kalanlar
  for (const s of durum.oyuncular) {
    if (s.yakalandi) continue;
    if (s.bot) {
      s._yonZaman -= dt;
      if (s._yonZaman <= 0) { s._yon = Math.random() * Math.PI * 2; s._yonZaman = rastgele(0.6, 2); }
      // Oyuncudan çok uzaklaşınca ona doğru yönel (grup halinde görünür kalsınlar)
      const ben0 = durum.oyuncular[0];
      const gdx = ben0.x - s.x, gdy = ben0.y - s.y, gd = Math.hypot(gdx, gdy);
      if (gd > BOT_GRUP_MENZIL) s._yon = Math.atan2(gdy, gdx) + (Math.random() - 0.5) * 0.7;
      const vx = Math.cos(s._yon) * BOT_HIZ * dt, vy = Math.sin(s._yon) * BOT_HIZ * dt;
      const ox = s.x, oy = s.y;
      hareketEt(durum.harita, s, vx, vy);
      if (s.x === ox && s.y === oy) s._yonZaman = 0; // duvara takıldı → yön değiştir
      else s.aci = Math.atan2(s.y - oy, s.x - ox);
      s.durgun = 0;
    } else {
      const v = girdi.hareketVektoru();
      if (v.x !== 0 || v.y !== 0) {
        hareketEt(durum.harita, s, v.x * OYUNCU_HIZ * dt, v.y * OYUNCU_HIZ * dt);
        s.aci = Math.atan2(v.y, v.x);
        s.durgun = 0;
      } else {
        s.durgun += dt;
      }
      // Beceri sesleri (test amaçlı; mekanik sonra) — sopa tek basış, kalkan basış kenarı
      if (girdi.sopaAl()) durum.sesler.push("sopa");
      if (girdi.kalkanBasiliMi()) { if (!s._kalkanBasili) { durum.sesler.push("kalkan"); s._kalkanBasili = true; } } else s._kalkanBasili = false;
      // Çıkışa ulaştı mı?
      if (cikistaMi(durum.harita, s.x, s.y)) { durum.bitti = true; durum.sonuc = "kacti"; durum.sesler.push("kacti"); return; }
    }
  }

  // Drone AI (her drone bağımsız devriye/kovala)
  for (const d of durum.droneler) {
    const adaylar = durum.oyuncular.filter((s) => algilanabilir(durum, s, d));
    if (adaylar.length) {
      const ben = adaylar.find((s) => s.id === "ben");
      const hedef = ben || adaylar[0];
      d.hedefId = hedef.id; d.mod = "kovala"; d.kayip = 0;
      d.hedefX = hedef.x; d.hedefY = hedef.y;
    } else if (d.mod === "kovala") {
      d.kayip += dt;
      if (d.kayip >= KAYIP_SURE) { d.mod = "devriye"; d.hedefId = null; }
    }

    const hiz = d.mod === "kovala" ? DRONE_KOVALA_HIZ : DRONE_DEVRIYE_HIZ;
    if (d.mod === "devriye" && Math.hypot(d.hedefX - d.x, d.hedefY - d.y) < 30) {
      const p = rastgeleNokta(durum.harita); d.hedefX = p.x; d.hedefY = p.y;
    }
    const ddx = d.hedefX - d.x, ddy = d.hedefY - d.y, duz = Math.hypot(ddx, ddy) || 1;
    d.x += (ddx / duz) * hiz * dt;
    d.y += (ddy / duz) * hiz * dt;
    d.aci = Math.atan2(ddy, ddx);

    // Yakalama (temas)
    for (const s of durum.oyuncular) {
      if (s.yakalandi) continue;
      if (Math.hypot(s.x - d.x, s.y - d.y) < YAKALA_YARICAP) {
        s.yakalandi = true;
        durum.sesler.push("yakala");
        if (s.id === "ben") { durum.bitti = true; durum.sonuc = "yakalandi"; durum.sesler.push("yakalandi"); }
      }
    }
  }

  // Kamera oyuncuyu takip eder
  const ben = durum.oyuncular[0];
  durum.kamera.x += (ben.x - durum.kamera.x) * Math.min(1, dt * 6);
  durum.kamera.y += (ben.y - durum.kamera.y) * Math.min(1, dt * 6);
}
