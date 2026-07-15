// ============================================================
// KAFA TOPU — maç durum makinesi (host-otoriter simülasyon).
// Fazlar: geri_sayim → oyun ⇄ gol_bekle → bitti
// Hem yerel (bot) maçta hem online host tarafında aynı kod çalışır.
// Misafirler simülasyon çalıştırmaz; anlikDurum() paketlerini render eder.
// ============================================================

import Matter from "matter-js";
import { dunyaKur, fizikAdim, pozisyonSifirla, golKontrol } from "./fizik.js";
import {
  gucDurumKur, guclerTick, yetenekKullan, kalkanlariTemizle,
  efektCarpanlari, efektBayraklari,
} from "./gucler.js";
import { FIZIK, OYUNCU, MAC, YETENEK, TOP } from "../shared/sabitler.js";

const { Body } = Matter;

export function bosGirdi() {
  return { sol: false, sag: false, zipla: false, vur: false, guc: false };
}

// meta: [{ slot, takim, kafa, yetenek, ad, foto, adminGuc }]
export function macKur({ mod, meta }) {
  const dunya = dunyaKur(mod);
  return {
    mod, meta, dunya,
    faz: "geri_sayim",
    fazSonu: MAC.BASLANGIC_GERI_SAYIM_SN * 1000,
    simMs: 0,
    birikenMs: 0,
    kalanMs: MAC.SURE_SN * 1000,
    skor: [0, 0],
    sonGol: 0,
    girdiler: meta.map(() => bosGirdi()),
    oncekiGuc: meta.map(() => false), // yetenek tuşu kenar algılama
    oyuncuDurum: meta.map((m) => ({
      vurusAnim: -9999,       // son vuruş animasyon zamanı
      sonVurus: -9999,
      yetenekSon: -YETENEK.BEKLEME_MS,
      efekt: { ates: 0, buz: 0, hiz: 0, yavas: 0, dev_sut: 0, buyuk: 0, mini: 0, dev: 0 },
      bayilmaBitis: 0,        // bu ana kadar bayılmış (topsuz vuruş yedi)
      bayilmaKoruma: 0,       // bu ana kadar tekrar bayıltılamaz
      olcek: 1,               // mevcut fiziksel kafa ölçeği
      kalkanBody: null,
      kalkanBitis: 0,
      adminGuc: !!m.adminGuc,
    })),
    guc: gucDurumKur(),
    olaylar: [],              // render/ses/ağ için tek seferlik olaylar
  };
}

// Dış girdiyi kaydet (yerel oyuncu ya da ağdan gelen misafir girdisi).
export function girdiAyarla(mac, slot, girdi) {
  if (mac.girdiler[slot]) mac.girdiler[slot] = { ...mac.girdiler[slot], ...girdi };
}

function vurusYap(mac, i) {
  const d = mac.oyuncuDurum[i];
  if (mac.simMs - d.sonVurus < OYUNCU.VURUS_BEKLEME_MS) return;
  d.sonVurus = mac.simMs;
  d.vurusAnim = mac.simMs;

  const b = mac.dunya.oyuncular[i];
  const top = mac.dunya.top;
  const menzil = OYUNCU.VURUS_MENZIL * Math.max(1, d.olcek);
  const yon = mac.meta[i].takim === 1 ? 1 : -1; // rakip kalesine doğru

  // --- Topa vuruş ---
  const dx = top.position.x - b.position.x;
  const dy = top.position.y - b.position.y;
  const mesafe = Math.hypot(dx, dy);
  if (mesafe <= menzil + TOP.R) {
    const carpan = efektCarpanlari(d, mac.simMs).vurus;
    Body.setVelocity(top, {
      x: yon * OYUNCU.VURUS_X * carpan + b.velocity.x * 0.35,
      y: -OYUNCU.VURUS_Y * carpan * (dy < -TOP.R ? 0.5 : 1), // top üstteyse daha yatay
    });
    mac.olaylar.push({ tip: "vurus", slot: i, guclu: carpan > 1.2 });
  } else {
    mac.olaylar.push({ tip: "vurus", slot: i, guclu: false });
  }

  // --- Topsuz vuruş: menzildeki (öndeki) rakibi bayılt (Head Ball klasiği) ---
  for (let r = 0; r < mac.meta.length; r++) {
    if (mac.meta[r].takim === mac.meta[i].takim) continue;
    const dr = mac.oyuncuDurum[r];
    if (mac.simMs < dr.bayilmaKoruma) continue; // taze bayıldı, koruma altında
    const rb = mac.dunya.oyuncular[r];
    const rdx = rb.position.x - b.position.x;
    const rdy = rb.position.y - b.position.y;
    const ruzak = Math.hypot(rdx, rdy);
    // Önümde ve tekme menzilinde mi? (hafif arkaya payı var, üst üsteyken de çalışsın)
    if (ruzak <= menzil * 0.95 && (Math.sign(rdx) === yon || Math.abs(rdx) < OYUNCU.KAFA_R)) {
      dr.bayilmaBitis = mac.simMs + OYUNCU.BAYILMA_MS;
      dr.bayilmaKoruma = dr.bayilmaBitis + OYUNCU.BAYILMA_KORUMA_MS;
      // Savrulma: rakip geriye ve hafif havaya itilir
      Body.setVelocity(rb, { x: yon * 6.5, y: Math.min(rb.velocity.y, -4) - (rdy > 0 ? 0 : 1) });
      mac.olaylar.push({ tip: "bayildi", slot: r, vuran: i });
      break; // tek vuruş tek rakip bayıltır
    }
  }
}

function girdileriUygula(mac) {
  for (let i = 0; i < mac.meta.length; i++) {
    const g = mac.girdiler[i];
    const d = mac.oyuncuDurum[i];
    const b = mac.dunya.oyuncular[i];
    const carpan = efektCarpanlari(d, mac.simMs);

    // Bayılmışken kontrol kilitli: savrulma fiziği kendi akışında sürsün,
    // ama kafa ölçeği efekti yine güncellensin.
    if (d.bayilmaBitis > mac.simMs) {
      if (Math.abs(carpan.olcek - d.olcek) > 0.01) {
        const k = carpan.olcek / d.olcek;
        Body.scale(b, k, k);
        Body.setInertia(b, Infinity);
        d.olcek = carpan.olcek;
      }
      mac.oncekiGuc[i] = g.guc;
      continue;
    }

    // Yatay hareket
    const yon = (g.sag ? 1 : 0) - (g.sol ? 1 : 0);
    Body.setVelocity(b, { x: yon * OYUNCU.HIZ * carpan.hiz, y: b.velocity.y });

    // Zıplama
    if (g.zipla && mac.dunya.yerdeMi(i)) {
      Body.setVelocity(b, { x: b.velocity.x, y: -OYUNCU.ZIPLAMA });
      mac.olaylar.push({ tip: "zipla", slot: i });
    }

    // Vuruş
    if (g.vur) vurusYap(mac, i);

    // Yetenek (yükselen kenar)
    if (g.guc && !mac.oncekiGuc[i]) yetenekKullan(mac, i);
    mac.oncekiGuc[i] = g.guc;

    // Kafa ölçeğini fiziğe yansıt (efekt değiştiyse)
    if (Math.abs(carpan.olcek - d.olcek) > 0.01) {
      const k = carpan.olcek / d.olcek;
      Body.scale(b, k, k);
      Body.setInertia(b, Infinity);
      d.olcek = carpan.olcek;
    }
  }
}

// dtMs kadar simülasyonu ilerlet (sabit 60Hz alt adımlarla).
export function macTick(mac, dtMs) {
  mac.birikenMs += Math.min(dtMs, 250); // sekme/duraklamada patlamayı önle
  while (mac.birikenMs >= FIZIK.TICK_MS) {
    mac.birikenMs -= FIZIK.TICK_MS;
    adim(mac);
  }
}

function adim(mac) {
  mac.simMs += FIZIK.TICK_MS;

  if (mac.faz === "geri_sayim") {
    if (mac.simMs >= mac.fazSonu) {
      mac.faz = "oyun";
      mac.olaylar.push({ tip: "basla" });
    }
    return; // fizik donuk
  }

  if (mac.faz === "gol_bekle") {
    // Gol sevinci: oyuncular serbestçe koşup zıplayabilir (Head Ball gibi);
    // saat durur, yeni gol sayılmaz, pozisyonlar süre sonunda sıfırlanır.
    girdileriUygula(mac);
    kalkanlariTemizle(mac);
    fizikAdim(mac.dunya);
    if (mac.simMs >= mac.fazSonu) {
      pozisyonSifirla(mac.dunya, mac.mod);
      mac.faz = "oyun";
    }
    return;
  }

  if (mac.faz === "bitti") return;

  // ---- faz: oyun ----
  mac.kalanMs -= FIZIK.TICK_MS;
  girdileriUygula(mac);
  guclerTick(mac, FIZIK.TICK_MS);
  kalkanlariTemizle(mac);
  fizikAdim(mac.dunya);

  const gol = golKontrol(mac.dunya.top);
  if (gol) {
    mac.skor[gol - 1] += 1;
    mac.sonGol = gol;
    mac.faz = "gol_bekle";
    mac.fazSonu = mac.simMs + MAC.GOL_BEKLE_MS;
    mac.olaylar.push({ tip: "gol", takim: gol, skor: [...mac.skor] });
    return;
  }

  if (mac.kalanMs <= 0) {
    mac.kalanMs = 0;
    mac.faz = "bitti";
    const kazanan = mac.skor[0] > mac.skor[1] ? 1 : mac.skor[1] > mac.skor[0] ? 2 : 0;
    mac.olaylar.push({ tip: "bitti", skor: [...mac.skor], kazanan });
  }
}

// Ağ/render için anlık durum paketi.
// bosalt=true: biriken olaylar pakete eklenip boşaltılır (ağ yayını için).
// bosalt=false: sadece görünüm okunur, olaylara dokunulmaz (yerel render için).
export function anlikDurum(mac, bosalt = true) {
  let olaylar = [];
  if (bosalt) {
    olaylar = mac.olaylar;
    mac.olaylar = [];
  }
  return {
    t: mac.simMs,
    kalan: mac.kalanMs,
    faz: mac.faz,
    fazSonu: mac.fazSonu,
    skor: mac.skor,
    sonGol: mac.sonGol,
    top: {
      x: mac.dunya.top.position.x, y: mac.dunya.top.position.y,
      vx: mac.dunya.top.velocity.x, vy: mac.dunya.top.velocity.y,
      a: mac.dunya.top.angle,
    },
    oy: mac.dunya.oyuncular.map((b, i) => {
      const d = mac.oyuncuDurum[i];
      return {
        x: b.position.x, y: b.position.y,
        vx: b.velocity.x, vy: b.velocity.y,
        va: d.vurusAnim, ol: d.olcek,
        ef: efektBayraklari(d, mac.simMs),
        yb: Math.max(0, (d.adminGuc ? 1000 : YETENEK.BEKLEME_MS) - (mac.simMs - d.yetenekSon)),
        kk: d.kalkanBody ? 1 : 0,
      };
    }),
    gucler: mac.guc.aktif.map((g) => ({ id: g.id, tip: g.tip, ikon: g.ikon, x: g.x, y: g.y })),
    olaylar,
  };
}
