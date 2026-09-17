// ============================================================
// BOĞAZ + KÖPRÜ (Aşama 3A-1 §B) — yürünebilir sınırın ötesindeki arka plan kuşağı. Yürünemez, yaklaşılamaz, çok düşük detay.
//
// NEDEN VADİ: oyun kamerası oyuncuya ~35° yukarıdan bakar; ekranın üst kenarı ufkun 11–14° ALTINDADIR. Plaza
// kotundaki (y=0) uzak bir deniz ya da yüksek bir köprü kulesi hiçbir zaman kadraja girmez (2A raporu: "plazanın
// içinden Boğaz görünmüyor"). Taksim gerçekte de Boğaz'dan ~80 m yüksekte bir tepedir: plazanın kuzeydoğu
// kenarından itibaren zemin TERAS TERAS alçalır (çatı şelalesi), deniz aşağıdadır — böylece deniz, köprü ve karşı
// kıyı kameranın gördüğü koninin içine düşer. Köprü birebir kopya değil; zorlanmış perspektifli, stilize siluet.
//
// KONUM HESAPLAMAZ: her ölçü manifestten (yerlesim.json › arkaplan: vadi · karsi_kiyi · kopru). Tek atlas, tek malzeme;
// bütün parçalar CevreArkaplan birleşik mesh'ine girer (ek çizim çağrısı YOK). Deniz `cam` bölgesiyle parlak.
// ============================================================
import * as THREE from "three";
import { hucreli } from "./cevre.js";

const BOLGE_CAM = 16;
const tohum = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const EV_TONLARI = ["#F3E6D2", "#FFE9B8", "#DCEFF7", "#E9D6C8", "#EAD9B8", "#F1E3CF"].map((h) => new THREE.Color(h));
const CATI_TONLARI = ["#C2553C", "#B4553E", "#A9523B", "#C9643F", "#B8664A"].map((h) => new THREE.Color(h));

/**
 * Plato kenarından d metre dışarıdaki eş-uzaklık hattı: batı doğrusu → plaza yayı → güney doğrusu (ikisi de manifestten,
 * dışa doğru AÇILAN iki yarı-doğru → vadi uzaklaştıkça genişler). Nokta sayısı sabit (bantlar eşleşsin).
 */
function kontur(v, d, uzak = v.uzak ?? 690, yay = 10) {
  const [cx, cz] = v.merkez, R = v.r + d;
  const kes = (hat) => {   // öteleme + çemberle kesişim (plazadan uzak kök) + uzak uç
    const [[x0, z0], [x1, z1]] = hat, L = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / L, tz = (z1 - z0) / L;
    let nx = -tz, nz = tx; if (nx * (v.ic_nokta[0] - x0) + nz * (v.ic_nokta[1] - z0) < 0) { nx = -nx; nz = -nz; }
    const qx = x0 + nx * d - cx, qz = z0 + nz * d - cz, bq = qx * tx + qz * tz, s = -bq + Math.sqrt(Math.max(0, bq * bq - (qx * qx + qz * qz - R * R)));
    return { bas: [cx + qx + tx * s, cz + qz + tz * s], son: [cx + qx + tx * (s + uzak), cz + qz + tz * (s + uzak)] };
  };
  const B = kes(v.bati_hat), G = kes(v.guney_hat);
  const fa = Math.atan2(-(B.bas[1] - cz), B.bas[0] - cx), fb = Math.atan2(-(G.bas[1] - cz), G.bas[0] - cx);
  const p = [B.son];
  for (let i = 0; i <= yay; i++) { const f = fa + (fb - fa) * (i / yay); p.push([cx + Math.cos(f) * R, cz - Math.sin(f) * R]); }
  p.push(G.son);
  return p;
}
/** k. terasın iç kenar uzaklığı: 0. bant dar seyir terası, sonrakiler eşit genişlikte. */
const terasD = (v, k) => (k <= 0 ? 0 : (v.teras.seyir ?? v.teras.genislik) + (k - 1) * v.teras.genislik);

/** Dış zemin (y≈0 asfalt) bu çokgenin içinde AÇILIR — vadi oradan görünür. */
export function vadiDeligi(M) {
  const v = (M.arkaplan ?? []).find((b) => b.tip === "vadi");
  if (!v) return null;
  const uzak = v.uzak ?? 690;
  return kontur(v, 0, uzak);   // iki uzak uç doğrudan birleşir (ıraksak doğrular → dışbükey kapanış)
}

let SERIT_MERKEZ = [0, 0];
function serit(a, b, ya, yb, rect, tint, bolge) {   // iki eş noktalı hat arasında şerit; yüz yukarı (düşeyse plazadan dışarı) bakar
  const pos = [];
  const ucgen = (P, Q, R) => {
    const ux = Q[0] - P[0], uy = Q[1] - P[1], uz = Q[2] - P[2], vx = R[0] - P[0], vy = R[1] - P[1], vz = R[2] - P[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ters = Math.abs(ny) > 1e-6 * Math.hypot(nx, ny, nz) + 1e-9 ? ny < 0 : nx * (P[0] - SERIT_MERKEZ[0]) + nz * (P[2] - SERIT_MERKEZ[1]) < 0;
    pos.push(...P, ...(ters ? R : Q), ...(ters ? Q : R));
  };
  for (let i = 0; i < a.length - 1; i++) {
    const A = [a[i][0], ya, a[i][1]], B = [a[i + 1][0], ya, a[i + 1][1]], C = [b[i + 1][0], yb, b[i + 1][1]], D = [b[i][0], yb, b[i][1]];
    ucgen(A, D, B); ucgen(B, D, C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.computeVertexNormals();
  return hucreli(g, rect, { tint, bolge, dolu: false });
}

/** Küçük ev: kutu + dört yüzlü açık çatı (16 üçgen). */
function ev(H, x, y, z, aci, en, der, yuk, k) {
  const kutu = new THREE.BoxGeometry(en, yuk, der);
  const cati = new THREE.ConeGeometry(Math.hypot(en, der) / 2 + 0.3, yuk * 0.22 + 0.8, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, der / en);
  const yer = (g, dy) => g.translate(0, dy, 0).rotateY(aci).translate(x, y, z);
  return [
    hucreli(yer(kutu, yuk / 2), H.siva, { tint: EV_TONLARI[k % EV_TONLARI.length], dolu: false }),
    hucreli(yer(cati, yuk + (yuk * 0.22 + 0.8) / 2), H.cerceve ?? H.siva, { tint: CATI_TONLARI[(k >> 2) % CATI_TONLARI.length], dolu: false }),
  ];
}

const kutuParca = (H, en, yuk, der, x, y, z, aci, renk, hucre = "cerceve") => hucreli(new THREE.BoxGeometry(en, yuk, der).rotateY(aci).translate(x, y, z), H[hucre] ?? H.siva, { tint: renk, dolu: false });

/**
 * @returns {THREE.BufferGeometry[]} CevreArkaplan'a katılacak parçalar (boş dizi: manifestte vadi yok)
 */
export function bogazParcalari({ M, hucreler: H }) {
  const parca = [];
  const v = (M.arkaplan ?? []).find((b) => b.tip === "vadi");
  if (!v) return parca;
  const T = v.teras, deniz = v.deniz_y;
  SERIT_MERKEZ = v.merkez;

  // ---- teraslar: üst yüz + dışa bakan istinat duvarı
  const zeminTon = new THREE.Color(v.teras_renk ?? "#D6CBB2"), duvarTon = new THREE.Color(v.duvar_renk ?? "#BFB39A");
  for (let k = 0; k < T.adet; k++) {
    const ic = kontur(v, terasD(v, k)), dis = kontur(v, terasD(v, k + 1)), y = -k * T.dusus;
    parca.push(serit(ic, dis, y, y, k === 0 ? H.tasAcik : H.kaldirim, k === 0 ? new THREE.Color("#E8DFCB") : zeminTon));
    const altY = k === T.adet - 1 ? deniz : -(k + 1) * T.dusus;
    parca.push(serit(dis, dis, y, altY, H.tas, duvarTon));
  }

  // ---- çatı şelalesi: teras ortalarına evler (yalnız plazaya yakın kesim; uzağı sis + deniz)
  const E = v.ev ?? {};
  let evSayisi = 0;
  for (let k = 1; k < T.adet; k++) {
    const hat = kontur(v, (terasD(v, k) + terasD(v, k + 1)) / 2, E.uzanim ?? 90, 14), y = -k * T.dusus;
    let kalan = (E.aralik ?? 11) * tohum(k, 3);
    for (let i = 0; i < hat.length - 1; i++) {
      const [x0, z0] = hat[i], [x1, z1] = hat[i + 1], boy = Math.hypot(x1 - x0, z1 - z0), aci = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let t = kalan; t <= boy; t += E.aralik ?? 11) {
        const s = t / boy, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s, r = tohum(x, z);
        if (Math.hypot(x - v.merkez[0], z - v.merkez[1]) > (E.uzanim ?? 90) + v.r + terasD(v, T.adet)) continue;
        parca.push(...ev(H, x, y, z, aci, 6 + r * 3, 5.5 + tohum(z, x) * 1.5, 4 + tohum(x, k) * 3.5, Math.floor(r * 97) + k * 7));
        evSayisi++; kalan = t + (E.aralik ?? 11) - boy;
      }
      if (kalan > (E.aralik ?? 11)) kalan -= boy;
    }
  }

  // ---- deniz: platonun altında büyük düzlem; renk kıyıdan ufka (STIL.md §1.3: #4FC3E8 → #9ED9F0)
  {
    const g = new THREE.PlaneGeometry(v.deniz_en ?? 760, v.deniz_boy ?? 700, 10, 10).rotateX(-Math.PI / 2).translate((v.deniz_en ?? 760) / 2 - 60, deniz, -(v.deniz_boy ?? 700) / 2 + 10);
    const su = hucreli(g, H.cerceve ?? H.cam, { bolge: BOLGE_CAM, dolu: false });
    const yakin = new THREE.Color(v.deniz_renk?.[0] ?? "#4FC3E8"), uzak = new THREE.Color(v.deniz_renk?.[1] ?? "#9ED9F0"), c = new THREE.Color();
    const pos = su.attributes.position, renk = su.attributes.color, kiyi = v.r + terasD(v, T.adet);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (Math.hypot(pos.getX(i) - v.merkez[0], pos.getZ(i) - v.merkez[1]) - kiyi) / (v.deniz_gecis ?? 320)));
      c.copy(yakin).lerp(uzak, t); renk.setXYZ(i, c.r, c.g, c.b);
    }
    parca.push(su);
  }

  // ---- karşı kıyı: kıyı hattından dışa doğru yükselen tepe şeridi + kıyı evleri
  for (const kk of (M.arkaplan ?? []).filter((b) => b.tip === "karsi_kiyi")) {
    const hat = kk.hat, n = hat.length, dis = (m) => hat.map(([x, z], i) => {
      const [ax, az] = hat[Math.max(0, i - 1)], [bx, bz] = hat[Math.min(n - 1, i + 1)], tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz) || 1;
      let nx = -tz / L, nz = tx / L; if (nx * (x - v.merkez[0]) + nz * (z - v.merkez[1]) < 0) { nx = -nx; nz = -nz; }   // plazadan uzağa
      return [x + nx * m, z + nz * m];
    });
    const yesil = new THREE.Color(kk.renk ?? "#7FA36E"), koyu = yesil.clone().multiplyScalar(0.86);
    const kademe = [[0, 1.5], [kk.derinlik * 0.18, kk.yukseklik * 0.45], [kk.derinlik * 0.5, kk.yukseklik], [kk.derinlik, kk.yukseklik * 0.7]];
    for (let i = 0; i < kademe.length - 1; i++) parca.push(serit(dis(kademe[i][0]), dis(kademe[i + 1][0]), deniz + kademe[i][1], deniz + kademe[i + 1][1], H.cim ?? H.siva, i % 2 ? koyu : yesil));
    parca.push(serit(dis(0), dis(0), deniz + 1.5, deniz - 0.5, H.tas, duvarTon));
    const sira = dis(kk.derinlik * 0.1);
    for (let i = 0; i < n - 1; i++) {
      const [x0, z0] = sira[i], [x1, z1] = sira[i + 1], boy = Math.hypot(x1 - x0, z1 - z0), aci = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let t = 8; t < Math.min(boy, kk.ev_uzanim ?? 160); t += kk.ev_aralik ?? 16) {
        const s = t / boy, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s;
        parca.push(...ev(H, x, deniz + kk.yukseklik * 0.3, z, aci, 7 + tohum(x, z) * 4, 6, 5 + tohum(z, x) * 4, Math.floor(tohum(x, 9) * 97)));
        evSayisi++;
      }
    }
  }

  // ---- köprü: stilize asma köprü silueti (tabliye · iki kule · ana halat · askılar)
  for (const b of (M.arkaplan ?? []).filter((q) => q.tip === "kopru" && q.kule_konum)) {
    const [x0, z0] = b.baslangic, [x1, z1] = b.bitis, boy = Math.hypot(x1 - x0, z1 - z0), aci = Math.atan2(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / boy, uz = (z1 - z0) / boy, gy = deniz + b.guverte_yukseklik, ky = deniz + b.kule_yukseklik, W = b.genislik ?? 5;
    const acik = new THREE.Color(b.renk ?? "#E3E8EC"), kule = new THREE.Color(b.kule_renk ?? "#C9D1D8");
    const P = (t, yan = 0) => [x0 + ux * boy * t + uz * yan, z0 + uz * boy * t - ux * yan];
    parca.push(kutuParca(H, W, 1.2, boy, (x0 + x1) / 2, gy, (z0 + z1) / 2, aci, acik));
    for (const t of b.kule_konum) {
      for (const yan of [-1, 1]) { const [x, z] = P(t, yan * (W / 2 + 0.4)); parca.push(kutuParca(H, 1.7, ky - deniz, 2.2, x, (ky + deniz) / 2, z, aci, kule)); }
      const [x, z] = P(t);
      for (const y of [ky - 1.2, gy + (ky - gy) * 0.45]) parca.push(kutuParca(H, W + 2.5, 1.4, 1.6, x, y, z, aci, kule));
    }
    // ana halat: kuleler arası parabol, kenar açıklıklarında düz
    const [ta, tb] = b.kule_konum, halat = (t) => t < ta ? gy + (ky - gy) * (t / ta) : t > tb ? gy + (ky - gy) * ((1 - t) / (1 - tb)) : gy + 1.5 + (ky - gy - 1.5) * ((2 * (t - ta) / (tb - ta) - 1) ** 2);
    const dilim = b.halat_dilim ?? 12, kal = b.halat_kalinlik ?? 0.7;
    for (const yan of [-1, 1]) {
      const dugum = [0, ta, ...Array.from({ length: dilim - 1 }, (_, i) => ta + (tb - ta) * ((i + 1) / dilim)), tb, 1];
      for (let i = 0; i < dugum.length - 1; i++) {
        const a = dugum[i], c = dugum[i + 1], ya = halat(a), yc = halat(c), L = Math.hypot((c - a) * boy, yc - ya), [mx, mz] = P((a + c) / 2, yan * (W / 2 + 0.4));
        const g = new THREE.BoxGeometry(kal, kal, L).rotateX(-Math.atan2(yc - ya, (c - a) * boy)).rotateY(aci).translate(mx, (ya + yc) / 2, mz);
        parca.push(hucreli(g, H.cerceve ?? H.siva, { tint: acik, dolu: false }));
        if (i >= 2 && i < dugum.length - 2 && (i % 2 === 0)) {   // askı
          const [hx, hz] = P(c, yan * (W / 2 + 0.4)), hy = halat(c);
          if (hy - gy > 1.2) parca.push(kutuParca(H, 0.3, hy - gy, 0.3, hx, (hy + gy) / 2, hz, aci, acik));
        }
      }
    }
  }
  bogazParcalari.son = { ev: evSayisi, ucgen: parca.reduce((a, g) => a + g.attributes.position.count / 3, 0) };
  return parca;
}
