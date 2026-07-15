// ============================================================
// KAFA TOPU — Matter.js fizik dünyası.
// Saha, kaleler (üst direkler), top ve oyuncu gövdeleri burada kurulur.
// Oyun kuralları (gol, skor, güçler) oyun.js'tedir; burası saf fizik.
// ============================================================

import Matter from "matter-js";
import { SAHA, KALE, FIZIK, OYUNCU, TOP } from "../shared/sabitler.js";

const { Engine, Bodies, Body, Composite, Events } = Matter;

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

  // ---- Yere basma takibi (zıplama izni için) ----
  // Oyuncunun altında temas varsa (zemin, direk, top ya da başka kafa) yerdedir.
  const yerdeSayac = oyuncular.map(() => 0);
  const oyuncuIndex = new Map(oyuncular.map((b, i) => [b.id, i]));

  const temasGuncelle = (pair, delta) => {
    const { bodyA, bodyB } = pair;
    for (const [oy, diger] of [[bodyA, bodyB], [bodyB, bodyA]]) {
      const i = oyuncuIndex.get(oy.id);
      if (i === undefined) continue;
      // Temas eden gövde oyuncunun altındaysa "yer" say.
      if (diger.position.y > oy.position.y + OYUNCU.KAFA_R * 0.4) {
        yerdeSayac[i] = Math.max(0, yerdeSayac[i] + delta);
      }
    }
  };
  Events.on(engine, "collisionStart", (e) => e.pairs.forEach((p) => temasGuncelle(p, +1)));
  Events.on(engine, "collisionEnd", (e) => e.pairs.forEach((p) => temasGuncelle(p, -1)));

  return {
    engine, top, oyuncular,
    yerdeMi: (i) =>
      yerdeSayac[i] > 0 ||
      // Emniyet: sayaç kaçarsa zemine yakınlık da yer kabul edilir.
      (oyuncular[i].position.y >= SAHA.ZEMIN_Y - OYUNCU.KAFA_R - 2 &&
        Math.abs(oyuncular[i].velocity.y) < 1),
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
