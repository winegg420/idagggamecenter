// ============================================================
// KAFA TOPU — Matter.js fizik dünyası.
// Saha, kaleler (üst direkler), top ve oyuncu gövdeleri burada kurulur.
// Oyun kuralları (gol, skor, güçler) oyun.js'tedir; burası saf fizik.
// ============================================================

import Matter from "matter-js";
import { SAHA, KALE, FIZIK, OYUNCU, TOP } from "../shared/sabitler.js";

const { Engine, Bodies, Body, Composite } = Matter;

// Oyuncu başlangıç noktaları (slot sırasına göre). Takım 1 sol, takım 2 sağ.
export function baslangicNoktalari(mod) {
  const y = SAHA.ZEMIN_Y - OYUNCU.KAFA_R;
  if (mod === "2v2") {
    // slot: 0 (t1 ön), 1 (t2 ön), 2 (t1 arka), 3 (t2 arka)
    return [
      { x: 380, y }, { x: 620, y },
      { x: 180, y }, { x: 820, y },
    ];
  }
  return [{ x: 260, y }, { x: 740, y }];
}

export function dunyaKur(mod) {
  const engine = Engine.create();
  engine.gravity.y = FIZIK.YERCEKIMI;

  const statikSecenek = { isStatic: true, friction: 0.15, restitution: 0.4 };

  // Zemin, tavan, yan duvarlar (kale arkası duvar görevi de görür)
  const zemin = Bodies.rectangle(SAHA.W / 2, SAHA.ZEMIN_Y + 40, SAHA.W + 400, 80, {
    ...statikSecenek, label: "zemin", restitution: 0.1,
  });
  const tavan = Bodies.rectangle(SAHA.W / 2, -40, SAHA.W + 400, 80, { ...statikSecenek, label: "tavan" });
  const solDuvar = Bodies.rectangle(-40, SAHA.H / 2, 80, SAHA.H * 2, { ...statikSecenek, label: "duvar" });
  const sagDuvar = Bodies.rectangle(SAHA.W + 40, SAHA.H / 2, 80, SAHA.H * 2, { ...statikSecenek, label: "duvar" });

  // Üst direkler (kale ağzının tavanı) — top ve oyuncu ikisine de çarpar
  const direkY = SAHA.ZEMIN_Y - KALE.ACIKLIK - KALE.DIREK / 2;
  const solDirek = Bodies.rectangle(KALE.DERINLIK / 2, direkY, KALE.DERINLIK, KALE.DIREK, {
    ...statikSecenek, label: "direk", restitution: 0.6,
  });
  const sagDirek = Bodies.rectangle(SAHA.W - KALE.DERINLIK / 2, direkY, KALE.DERINLIK, KALE.DIREK, {
    ...statikSecenek, label: "direk", restitution: 0.6,
  });

  // Top
  const top = Bodies.circle(SAHA.W / 2, 180, TOP.R, {
    label: "top",
    restitution: TOP.SEKME,
    frictionAir: TOP.HAVA_SURTUNME,
    friction: 0.05,
    density: TOP.YOGUNLUK,
  });

  // Oyuncular
  const noktalar = baslangicNoktalari(mod);
  const oyuncular = noktalar.map((n, i) => {
    const b = Bodies.circle(n.x, n.y, OYUNCU.KAFA_R, {
      label: `oyuncu_${i}`,
      friction: 0.02,
      frictionStatic: 0,
      frictionAir: 0.012,
      restitution: 0.02,
      density: 0.004,
    });
    Body.setInertia(b, Infinity); // kafalar dönmez
    return b;
  });

  Composite.add(engine.world, [
    zemin, tavan, solDuvar, sagDuvar, solDirek, sagDirek, top, ...oyuncular,
  ]);

  // ---- Yere basma kontrolü (zıplama izni) ----
  // Olay tabanlı sayaç yerine her çağrıda anlık geometri kontrolü yapılır;
  // sayaç top/kafa temaslarında takılı kalıp "havada sürekli zıplama"
  // (göğe uçma) hatası üretebiliyordu. Kurallar:
  //  - yükselirken (vy < -1) asla "yerde" değilsin (çift zıplama olmaz),
  //  - zemine yakınsan yerdesin,
  //  - başka bir kafanın tam üstündeysen yerdesin (kafadan sekme klasiği).
  const yerdeMi = (i) => {
    const b = oyuncular[i];
    if (b.velocity.y < -1) return false;
    const r = b.circleRadius || OYUNCU.KAFA_R; // Body.scale yarıçapı günceller
    if (b.position.y + r >= SAHA.ZEMIN_Y - 4) return true;
    for (let j = 0; j < oyuncular.length; j++) {
      if (j === i) continue;
      const d = oyuncular[j];
      const dr = d.circleRadius || OYUNCU.KAFA_R;
      const ustY = d.position.y - dr; // diğer kafanın tepesi
      if (
        Math.abs(b.position.x - d.position.x) < (r + dr) * 0.75 &&
        b.position.y + r >= ustY - 6 &&
        b.position.y + r <= ustY + dr * 0.6
      ) {
        return true;
      }
    }
    return false;
  };

  return {
    engine, top, oyuncular,
    yerdeMi,
    // Kale ağzı bariyeri (kalkan yeteneği): takim 1 → sol kale, 2 → sağ kale.
    kalkanEkle(takim) {
      const x = takim === 1 ? KALE.DERINLIK + 8 : SAHA.W - KALE.DERINLIK - 8;
      const yUst = SAHA.ZEMIN_Y - KALE.ACIKLIK;
      const b = Bodies.rectangle(x, yUst + KALE.ACIKLIK / 2, 12, KALE.ACIKLIK, {
        isStatic: true, label: `kalkan_${takim}`, restitution: 0.5,
      });
      Composite.add(engine.world, b);
      return b;
    },
    kalkanKaldir(b) {
      try { Composite.remove(engine.world, b); } catch { /* zaten yok */ }
    },
  };
}

// Sabit adımlı fizik ilerletme + top hız tavanı.
export function fizikAdim(dunya) {
  // Plaj topu yüzerliği: oyuncular ağır düşerken top süzülsün diye
  // topa yerçekiminin bir kısmını dengeleyen ters kuvvet uygulanır.
  const g = dunya.engine.gravity;
  Body.applyForce(dunya.top, dunya.top.position, {
    x: 0,
    y: -dunya.top.mass * g.y * (g.scale ?? 0.001) * TOP.YUZERLIK,
  });
  Matter.Engine.update(dunya.engine, FIZIK.TICK_MS);
  const v = dunya.top.velocity;
  const hiz = Math.hypot(v.x, v.y);
  if (hiz > TOP.MAX_HIZ) {
    const k = TOP.MAX_HIZ / hiz;
    Body.setVelocity(dunya.top, { x: v.x * k, y: v.y * k });
  }
}

// Pozisyonları başlangıca döndür (gol sonrası / maç başı).
export function pozisyonSifirla(dunya, mod) {
  const noktalar = baslangicNoktalari(mod);
  dunya.oyuncular.forEach((b, i) => {
    Body.setPosition(b, noktalar[i]);
    Body.setVelocity(b, { x: 0, y: 0 });
  });
  Body.setPosition(dunya.top, { x: SAHA.W / 2, y: 170 });
  Body.setVelocity(dunya.top, { x: 0, y: 0 });
  Body.setAngularVelocity(dunya.top, 0);
}

// Gol kontrolü: top kale ağzının gerisine tam girdiyse.
// Dönüş: 0 = gol yok, 1 = takım 1 attı (sağ kaleye), 2 = takım 2 attı (sol kaleye).
export function golKontrol(top) {
  const { x, y } = top.position;
  const kaleUst = SAHA.ZEMIN_Y - KALE.ACIKLIK;
  if (y > kaleUst + TOP.R / 2) {
    if (x < KALE.DERINLIK - TOP.R * 0.4) return 2;          // sol kaleye girdi → takım 2 attı
    if (x > SAHA.W - KALE.DERINLIK + TOP.R * 0.4) return 1; // sağ kaleye girdi → takım 1 attı
  }
  return 0;
}
