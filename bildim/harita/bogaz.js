// ============================================================
// BOĞAZ + KÖPRÜ (Aşama 3A-1 §B, düzeltme 3A-2 §B) — yürünebilir sınırın ötesindeki arka plan kuşağı. Yürünemez, çok düşük detay.
//
// NEDEN VADİ: oyun kamerası oyuncuya ~35° yukarıdan bakar; ekranın üst kenarı ufkun 11–14° ALTINDADIR. Plaza
// kotundaki (y=0) uzak deniz ya da köprü kadraja girmez. Taksim gerçekte de tepedir: plazanın kuzeydoğu kenarından
// itibaren zemin TERAS TERAS alçalır, deniz aşağıdadır. Köprü birebir kopya değil; zorlanmış perspektifli, stilize siluet.
//
// 3A-2 DÜZELTMESİ (sahibinin geri bildirimi: "köprü neden aşağıda" · "sıra sıra bina kötü duruyor"):
//   · deniz −60 → −35, köprü kulesi 50 / tabliye 20 (deniz kotundan) — köprü plaza hizasına yaklaşır, altı görünür
//   · teras düşüşü deniz kotundan TÜRETİLİR (dusus = |deniz_y| / adet) → vadide boşluk / bindirme olmaz
//   · teras kenarları tohumlu kırık hat (jilet gibi kesik değil)
//   · evler ÖBEK öbek (3–5), öbekler arası boşluk + ağaç kümesi; eşit aralık YOK. Boy 3 kademe, renk 4 ton
//   · karşı kıyı ~40 ev + 2–3 minare silueti
//   · ağaçlar mevcut ağaç InstancedMesh'ine örnek olarak eklenir (cevre.js › propKonumlari) → ek çağrı yok
//
// KONUM HESAPLAMAZ: her ölçü manifestten (yerlesim.json › arkaplan: vadi · karsi_kiyi · kopru). Dizilim tohumdan
// (manifest `tohum`) deterministik — her açılışta aynı şehir. Tek atlas, tek malzeme; hepsi CevreArkaplan birleşik
// mesh'ine girer (ek çizim çağrısı YOK).
// ============================================================
import * as THREE from "three";
import { hucreli } from "./cevre.js";

const BOLGE_CAM = 16;
const tohum = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
/** Ev renkleri: 4 ton (sıva hücresi × köşe rengi). Çatı: 2 ton kiremit. */
const EV_TONLARI = ["#F3E6D2", "#FFE9B8", "#DCEFF7", "#EAD2C4"].map((h) => new THREE.Color(h));
const CATI_TONLARI = ["#C2553C", "#A9523B"].map((h) => new THREE.Color(h));
/** Ev boyu 3 kademe: [en, derinlik, yükseklik] */
const EV_BOYU = [[5.5, 5, 4], [7, 6, 6.5], [8.5, 7, 9.5]];

const vadiOf = (M) => (M.arkaplan ?? []).find((b) => b.tip === "vadi");
/** Teras düşüşü deniz kotundan türetilir: son terasın duvarı tam deniz kotuna iner. */
const dususOf = (v) => (v.teras.dusus ?? Math.abs(v.deniz_y) / v.teras.adet);

/**
 * Plato kenarından d metre dışarıdaki eş-uzaklık hattı: batı doğrusu → plaza yayı → güney doğrusu (ikisi de manifestten,
 * dışa doğru AÇILAN iki yarı-doğru → vadi uzaklaştıkça genişler). Nokta sayısı sabit (bantlar eşleşsin).
 * `kirik` > 0 ise ara noktalar plazadan dışa/içe tohumlu kaydırılır — aynı d aynı kırığı verir (üst yüz ↔ duvar eşleşir).
 */
function kontur(v, d, uzak = v.uzak ?? 690, yay = 14, kirik = 0) {
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
  for (let i = 0; i <= yay; i++) {
    const f = fa + (fb - fa) * (i / yay), j = kirik && i > 0 && i < yay ? (tohum(d * 3.7 + (v.tohum ?? 1), i) - 0.5) * kirik : 0;
    p.push([cx + Math.cos(f) * (R + j), cz - Math.sin(f) * (R + j)]);
  }
  p.push(G.son);
  return p;
}
/** k. terasın iç kenar uzaklığı: 0. bant dar seyir terası, sonrakiler eşit genişlikte. */
const terasD = (v, k) => (k <= 0 ? 0 : (v.teras.seyir ?? v.teras.genislik) + (k - 1) * v.teras.genislik);
const terasKontur = (v, k) => kontur(v, terasD(v, k), v.uzak ?? 690, 14, k === 0 ? 0 : v.teras.kirik ?? 0);

/** Dış zemin (y≈0 asfalt) bu çokgenin içinde AÇILIR — vadi oradan görünür. */
export function vadiDeligi(M) {
  const v = vadiOf(M);
  if (!v) return null;
  return kontur(v, 0, v.uzak ?? 690);   // iki uzak uç doğrudan birleşir (ıraksak doğrular → dışbükey kapanış)
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

/** Küçük ev: kutu (tabansız, 10 üçgen) + dört yüzlü açık çatı (4 üçgen). */
function ev(H, e) {
  const [en, der, yuk] = EV_BOYU[e.boy], kutu = new THREE.BoxGeometry(en, yuk, der).toNonIndexed();
  const p = kutu.attributes.position.array, tut = [];
  for (let t = 0; t < p.length / 9; t++) if (!(p[t * 9 + 1] < 0 && p[t * 9 + 4] < 0 && p[t * 9 + 7] < 0)) tut.push(...p.slice(t * 9, t * 9 + 9));   // taban yüzü atılır
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(tut, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(tut.length / 3 * 2), 2)); g.computeVertexNormals();
  const cy = yuk * 0.24 + 0.8, cati = new THREE.ConeGeometry(Math.hypot(en, der) / 2 + 0.3, cy, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, der / en);
  const yer = (geo, dy) => geo.translate(0, dy, 0).rotateY(e.aci).translate(e.x, e.y, e.z);
  return [
    hucreli(yer(g, yuk / 2 - 0.6), H.siva, { tint: EV_TONLARI[e.ton], dolu: false }),   // 0,6 m zemine gömülü: yamaçta havada kalmasın
    hucreli(yer(cati, yuk - 0.6 + cy / 2), H.cerceve ?? H.siva, { tint: CATI_TONLARI[e.ton % 2], dolu: false }),
  ];
}

const kutuParca = (H, en, yuk, der, x, y, z, aci, renk, hucre = "cerceve") => hucreli(new THREE.BoxGeometry(en, yuk, der).rotateY(aci).translate(x, y, z), H[hucre] ?? H.siva, { tint: renk, dolu: false });

/**
 * Bir hat boyunca ÖBEK dizilimi (deterministik): [boşluk] [öbek: 3–5 ev] [boşluk + ağaç kümesi] …
 * @returns {{evler: object[], agaclar: object[]}}
 */
function obekDiz({ boy, nokta, tohumNo, obek, derinlik = [0, 0], yEv, yAgac }) {
  const evler = [], agaclar = [];
  const r = (i, k = 0) => tohum(tohumNo * 1.37 + i * 0.731, k + tohumNo * 0.19);
  const enAz = obek.en_az ?? 3, enFazla = obek.en_fazla ?? 5, bos = obek.bosluk ?? 14, enCok = obek.en_cok ?? 999;
  let t = bos * (0.3 + r(0) * 0.7), no = 0, sayac = 0;
  while (t < boy && evler.length < enCok) {
    const adet = enAz + Math.floor(r(no, 1) * (enFazla - enAz + 1));
    for (let i = 0; i < adet && t < boy && evler.length < enCok; i++) {
      const s = sayac++, boyK = r(s, 2) < 0.45 ? 0 : r(s, 2) < 0.82 ? 1 : 2, en = EV_BOYU[boyK][0];
      const m = derinlik[0] + (derinlik[1] - derinlik[0]) * r(s, 3), n = nokta(t), [x, z] = n.yan(m);
      evler.push({ x, z, y: yEv(m), aci: n.aci + (r(s, 4) - 0.5) * 0.35, boy: boyK, ton: Math.floor(r(s, 5) * 4) % 4 });
      t += en + 1.2 + r(s, 6) * 2.2;
    }
    // öbekler arası boşluk + ağaç kümesi (2–4)
    const bosluk = bos * (0.7 + r(no, 7) * 0.9), orta = t + bosluk / 2;
    if (orta < boy) {
      const ag = 2 + Math.floor(r(no, 8) * 3);
      for (let j = 0; j < ag; j++) {
        const n = nokta(Math.min(boy, orta + (r(no * 7 + j, 9) - 0.5) * bosluk * 0.6)), m = derinlik[0] + (derinlik[1] - derinlik[0]) * r(no * 5 + j, 10), [x, z] = n.yan(m);
        agaclar.push({ x, z, y: yAgac(m), olcek: (obek.agac_olcek ?? 1) * (0.85 + r(no + j, 11) * 0.4), don: r(j, no) * 6.28 });
      }
    }
    t += bosluk; no++;
  }
  return { evler, agaclar };
}

/** Çoklu çizgi üzerinde t (m) → nokta; `yan(m)`: plazadan uzağa bakan normal boyunca m metre. */
function hatFonksiyonu(hat, merkez) {
  const seg = []; let top = 0;
  for (let i = 0; i < hat.length - 1; i++) { const L = Math.hypot(hat[i + 1][0] - hat[i][0], hat[i + 1][1] - hat[i][1]); seg.push([top, L, i]); top += L; }
  const nokta = (t) => {
    const [bas, L, i] = seg.find(([b, l]) => t <= b + l) ?? seg[seg.length - 1], s = Math.min(1, Math.max(0, (t - bas) / L));
    const [x0, z0] = hat[i], [x1, z1] = hat[i + 1], tx = (x1 - x0) / L, tz = (z1 - z0) / L, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s;
    let nx = -tz, nz = tx; if (nx * (x - merkez[0]) + nz * (z - merkez[1]) < 0) { nx = -nx; nz = -nz; }
    return { x, z, aci: Math.atan2(nx, nz), yan: (m) => [x + nx * m, z + nz * m] };
  };
  return { boy: top, nokta };
}

/**
 * Boğaz yerleşimi (saf veri, önbellekli): evler, ağaçlar, minareler. cevre.js ağaç örneklerini buradan alır.
 * @returns {{ evler: object[], agaclar: object[], minareler: object[] } | null}
 */
const yerlesimOnbellek = new WeakMap();
export function bogazYerlesimi(M) {
  if (yerlesimOnbellek.has(M)) return yerlesimOnbellek.get(M);
  const v = vadiOf(M);
  if (!v) { yerlesimOnbellek.set(M, null); return null; }
  const T = v.teras, dusus = dususOf(v), sonuc = { evler: [], agaclar: [], minareler: [] };
  // ---- teraslar: her terasın orta hattında seyrek öbekler (yalnız plazaya yakın yay; uzak uçlar hariç)
  const E = v.ev ?? {};
  for (let k = 1; k < T.adet; k++) {
    const hat = kontur(v, (terasD(v, k) + terasD(v, k + 1)) / 2, E.uzanim ?? 80, 14);   // vadi ağzı dar (~30 m yay): iki yan doğru boyunca uzanim metre dahil
    const H = hatFonksiyonu(hat, v.merkez), y = -k * dusus;
    const d = obekDiz({ boy: H.boy, nokta: H.nokta, tohumNo: (v.tohum ?? 1) * 10 + k, obek: { ...E, en_cok: E.teras_basina ?? 5 }, derinlik: [-2, 2], yEv: () => y, yAgac: () => y });
    sonuc.evler.push(...d.evler); sonuc.agaclar.push(...d.agaclar);
  }
  // ---- karşı kıyı: tepe profiline oturan öbekler + minareler
  for (const kk of (M.arkaplan ?? []).filter((b) => b.tip === "karsi_kiyi")) {
    const H = hatFonksiyonu(kk.hat, v.merkez), deniz = v.deniz_y;
    const kademe = [[0, 1.5], [kk.derinlik * 0.18, kk.yukseklik * 0.45], [kk.derinlik * 0.5, kk.yukseklik], [kk.derinlik, kk.yukseklik * 0.7]];
    const tepeY = (m) => { for (let i = 0; i < kademe.length - 1; i++) if (m <= kademe[i + 1][0]) { const [a, ya] = kademe[i], [b, yb] = kademe[i + 1]; return deniz + ya + (yb - ya) * ((m - a) / (b - a)); } return deniz + kademe[kademe.length - 1][1]; };
    const bas = kk.ev_baslangic ?? 0, uzanim = Math.min(H.boy - bas, kk.ev_uzanim ?? 160), nokta = (t) => H.nokta(bas + t);
    const d = obekDiz({ boy: uzanim, nokta, tohumNo: (v.tohum ?? 1) * 100 + 7, obek: kk.obek ?? {}, derinlik: kk.ev_derinlik ?? [6, 40], yEv: tepeY, yAgac: tepeY });
    sonuc.evler.push(...d.evler); sonuc.agaclar.push(...d.agaclar);
    for (const t of kk.minare_konum ?? []) { const m = kk.minare_derinlik ?? 10, [x, z] = nokta(t * uzanim).yan(m); sonuc.minareler.push({ x, z, y: tepeY(m), yuk: kk.minare_yukseklik ?? 24 }); }
  }
  yerlesimOnbellek.set(M, sonuc);
  return sonuc;
}

/**
 * @returns {THREE.BufferGeometry[]} CevreArkaplan'a katılacak parçalar (boş dizi: manifestte vadi yok)
 */
export function bogazParcalari({ M, hucreler: H }) {
  const parca = [];
  const v = vadiOf(M);
  if (!v) return parca;
  const T = v.teras, deniz = v.deniz_y, dusus = dususOf(v), Y = bogazYerlesimi(M);
  SERIT_MERKEZ = v.merkez;

  // ---- teraslar: üst yüz + dışa bakan istinat duvarı (kırık kenar). Son terasın duvarı TAM deniz kotuna iner.
  const zeminTon = new THREE.Color(v.teras_renk ?? "#D6CBB2"), duvarTon = new THREE.Color(v.duvar_renk ?? "#BFB39A"), cimTon = new THREE.Color(v.teras_yesil ?? "#9BBF7F");
  for (let k = 0; k < T.adet; k++) {
    const ic = terasKontur(v, k), dis = terasKontur(v, k + 1), y = -k * dusus;
    parca.push(serit(ic, dis, y, y, k === 0 ? H.tasAcik : H.cim ?? H.kaldirim, k === 0 ? new THREE.Color("#E8DFCB") : k % 2 ? cimTon : zeminTon));
    parca.push(serit(dis, dis, y, k === T.adet - 1 ? deniz : -(k + 1) * dusus, H.tas, duvarTon));
  }

  // ---- evler (teras + karşı kıyı, öbekli)
  for (const e of Y.evler) parca.push(...ev(H, e));

  // ---- deniz: platonun altında büyük düzlem; renk kıyıdan ufka (STIL.md §1.3: #4FC3E8 → #9ED9F0)
  {
    const g = new THREE.PlaneGeometry(v.deniz_en ?? 760, v.deniz_boy ?? 700, 6, 6).rotateX(-Math.PI / 2).translate((v.deniz_en ?? 760) / 2 - 60, deniz, -(v.deniz_boy ?? 700) / 2 + 10);
    const su = hucreli(g, H.cerceve ?? H.cam, { bolge: BOLGE_CAM, dolu: false });
    const yakin = new THREE.Color(v.deniz_renk?.[0] ?? "#4FC3E8"), uzak = new THREE.Color(v.deniz_renk?.[1] ?? "#9ED9F0"), c = new THREE.Color();
    const pos = su.attributes.position, renk = su.attributes.color, kiyi = v.r + terasD(v, T.adet);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (Math.hypot(pos.getX(i) - v.merkez[0], pos.getZ(i) - v.merkez[1]) - kiyi) / (v.deniz_gecis ?? 320)));
      c.copy(yakin).lerp(uzak, t); renk.setXYZ(i, c.r, c.g, c.b);
    }
    parca.push(su);
  }

  // ---- karşı kıyı: kıyı hattından dışa doğru yükselen tepe şeridi
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
  }

  // ---- minare siluetleri: ince 8 yüzlü gövde + şerefe bileziği + külah (40 üçgen)
  const minareTon = new THREE.Color("#F1EBDF"), kulahTon = new THREE.Color("#7E8C99");
  for (const m of Y.minareler) {
    const govde = new THREE.CylinderGeometry(0.9, 1.1, m.yuk, 8, 1, true).translate(m.x, m.y + m.yuk / 2 - 1, m.z);
    const serefe = new THREE.CylinderGeometry(1.5, 1.5, 0.8, 8, 1, true).translate(m.x, m.y + m.yuk * 0.78, m.z);
    const kulah = new THREE.ConeGeometry(1.0, 5, 8, 1, true).translate(m.x, m.y + m.yuk + 1.5, m.z);
    parca.push(hucreli(govde, H.siva, { tint: minareTon, dolu: false }), hucreli(serefe, H.siva, { tint: minareTon, dolu: false }), hucreli(kulah, H.cerceve ?? H.siva, { tint: kulahTon, dolu: false }));
  }

  // ---- köprü: stilize asma köprü silueti (tabliye · iki kule · ana halat · askılar). Yükseklikler DENİZ kotundan.
  for (const b of (M.arkaplan ?? []).filter((q) => q.tip === "kopru" && q.kule_konum)) {
    const [x0, z0] = b.baslangic, [x1, z1] = b.bitis, boy = Math.hypot(x1 - x0, z1 - z0), aci = Math.atan2(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / boy, uz = (z1 - z0) / boy, gy = deniz + b.guverte_yukseklik, ky = deniz + b.kule_yukseklik, W = b.genislik ?? 5;
    const acik = new THREE.Color(b.renk ?? "#E3E8EC"), kule = new THREE.Color(b.kule_renk ?? "#C9D1D8");
    const P = (t, yan = 0) => [x0 + ux * boy * t + uz * yan, z0 + uz * boy * t - ux * yan];
    parca.push(kutuParca(H, W, 1.4, boy, (x0 + x1) / 2, gy, (z0 + z1) / 2, aci, acik));
    for (const t of b.kule_konum) {
      for (const yan of [-1, 1]) { const [x, z] = P(t, yan * (W / 2 + 0.5)); parca.push(kutuParca(H, 2.0, ky - deniz, 2.6, x, (ky + deniz) / 2, z, aci, kule)); }
      const [x, z] = P(t);
      for (const y of [ky - 1.4, gy + (ky - gy) * 0.45]) parca.push(kutuParca(H, W + 3, 1.6, 1.8, x, y, z, aci, kule));
    }
    // ana halat: kuleler arası parabol, kenar açıklıklarında düz
    const [ta, tb] = b.kule_konum, halat = (t) => t < ta ? gy + (ky - gy) * (t / ta) : t > tb ? gy + (ky - gy) * ((1 - t) / (1 - tb)) : gy + 1.5 + (ky - gy - 1.5) * ((2 * (t - ta) / (tb - ta) - 1) ** 2);
    const dilim = b.halat_dilim ?? 10, kal = b.halat_kalinlik ?? 0.8;
    for (const yan of [-1, 1]) {
      const dugum = [0, ta, ...Array.from({ length: dilim - 1 }, (_, i) => ta + (tb - ta) * ((i + 1) / dilim)), tb, 1];
      for (let i = 0; i < dugum.length - 1; i++) {
        const a = dugum[i], c = dugum[i + 1], ya = halat(a), yc = halat(c), L = Math.hypot((c - a) * boy, yc - ya), [mx, mz] = P((a + c) / 2, yan * (W / 2 + 0.5));
        const g = new THREE.BoxGeometry(kal, kal, L).rotateX(-Math.atan2(yc - ya, (c - a) * boy)).rotateY(aci).translate(mx, (ya + yc) / 2, mz);
        parca.push(hucreli(g, H.cerceve ?? H.siva, { tint: acik, dolu: false }));
        if (i >= 2 && i < dugum.length - 2 && (i % 2 === 0)) {   // askı
          const [hx, hz] = P(c, yan * (W / 2 + 0.5)), hy = halat(c);
          if (hy - gy > 1.2) parca.push(kutuParca(H, 0.35, hy - gy, 0.35, hx, (hy + gy) / 2, hz, aci, acik));
        }
      }
    }
  }
  bogazParcalari.son = { ev: Y.evler.length, agac: Y.agaclar.length, minare: Y.minareler.length, ucgen: parca.reduce((a, g) => a + g.attributes.position.count / 3, 0) };
  return parca;
}
