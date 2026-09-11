// ============================================================
// DANSLAR — avatarın gövdesiyle oynanan kısa hareketler
//
// Dışarıdan ANİMASYON DOSYASI İNDİRİLMEZ. Her dans, avatarın hazır
// parçalarını (kök, gövde, kollar, bacaklar, kafa) zamanın fonksiyonu olarak
// oynatan küçük bir kod parçasıdır. Eşyalarda olduğu gibi katalog veri
// tabanındadır (`esyalar` tablosu, yuva = 'dans'); buradaki tek şey her dans
// KODUNUN nasıl oynatılacağı.
//
// KURAL — avatarın kendi `rotation.y`sine ve `position.x/z`sine DOKUNULMAZ:
// onlar yürüme yönünü ve konumu tutuyor (meydanda yumusakDon, Görünüm
// sayfasında tornavida dönüşü). Dans yalnız `userData.kok` ve altındaki
// parçaları oynatır; `position.y` yürüme animasyonuyla ortak kullanılır ve
// dans biterken sıfırlanır.
// ============================================================

/** Dans kaç saniye oynar (hem kendi hem uzak oyuncuda aynı). */
export const DANS_SURESI = 6;

const TAU = Math.PI * 2;

/** Basamaklı (robot) değer — yumuşak sinüsü kademeye çevirir. */
function basamak(v, adet) {
  return Math.round(v * adet) / adet;
}

// Her üretici (p, t) alır:
//   p = { kok, govde, kollar, bacaklar, kafa, sol, sag, solBacak, sagBacak }
//   t = dans başlangıcından beri geçen saniye
const HAREKETLER = {
  // ---- Selam: bir kol yukarıda sallanır, gövde hafif salınır ----
  dns_01(p, t) {
    const s = Math.sin(t * 6);
    p.sag.rotation.z = 2.05 + s * 0.38;   // kol yukarı, yana sallanıyor
    p.sag.rotation.x = s * 0.12;
    p.sol.rotation.z = -0.15;
    p.kok.rotation.z = s * 0.05;
    p.kafa.position.y = 3.05 + Math.abs(s) * 0.04;
  },

  // ---- Zıplama: çift ayak sıçrama + dizler toplanır ----
  dns_02(p, t, av) {
    const f = (t * 2.1) % 1;
    const h = Math.max(0, Math.sin(f * Math.PI));
    av.position.y = h * 0.85;
    p.kok.position.y = -h * 0.12;         // çömelip açılma hissi
    p.solBacak.rotation.x = -h * 0.9;
    p.sagBacak.rotation.x = -h * 0.9;
    p.kollar.rotation.x = -h * 1.5;
    p.kok.rotation.x = h * 0.12;
  },

  // ---- Robot: kademeli kol ve gövde açıları ----
  dns_03(p, t) {
    const s = basamak(Math.sin(t * 3.2), 3);
    const c = basamak(Math.cos(t * 3.2), 3);
    p.sag.rotation.z = 1.0 + s * 0.7;
    p.sol.rotation.z = -1.0 - c * 0.7;
    p.sag.rotation.x = c * 0.5;
    p.sol.rotation.x = -s * 0.5;
    p.kok.rotation.y = basamak(Math.sin(t * 1.6), 2) * 0.5;
    p.kafa.rotation.z = s * 0.2;
  },

  // ---- Twist: gövde sağa sola burulur, dizler bükülür ----
  dns_04(p, t, av) {
    const s = Math.sin(t * 5);
    p.kok.rotation.y = s * 0.7;
    p.kollar.rotation.x = -0.9;
    p.sag.rotation.z = 0.5 + s * 0.3;
    p.sol.rotation.z = -0.5 + s * 0.3;
    p.solBacak.rotation.x = s * 0.25;
    p.sagBacak.rotation.x = -s * 0.25;
    av.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
  },

  // ---- Fırıldak: kök kendi ekseninde döner, kollar açılır ----
  dns_05(p, t, av) {
    p.kok.rotation.y = (t * 5.5) % TAU;
    p.sag.rotation.z = 1.45;              // kollar yana açık
    p.sol.rotation.z = -1.45;
    p.kok.rotation.z = Math.sin(t * 5.5) * 0.08;
    av.position.y = Math.abs(Math.sin(t * 5.5)) * 0.12;
  },

  // ---- Zafer: iki kol havada, sıçrayarak dönüş ----
  dns_06(p, t, av) {
    const f = (t * 1.6) % 1;
    const h = Math.max(0, Math.sin(f * Math.PI));
    av.position.y = h * 0.7;
    p.kok.rotation.y = t * 2.2;
    p.sag.rotation.z = 2.35;
    p.sol.rotation.z = -2.35;
    p.kollar.rotation.x = -0.2 - h * 0.3;
    p.solBacak.rotation.x = -h * 0.7;
    p.sagBacak.rotation.x = h * 0.5;
  },

  // ---- Kalça hareketi (etkinlik ödülü): kalçadan salınım ----
  dns_07(p, t, av) {
    const s = Math.sin(t * 4.4);
    p.kok.rotation.z = s * 0.22;
    p.kok.position.x = s * 0.18;
    p.kollar.rotation.x = -1.15;
    p.sag.rotation.z = 0.9 - s * 0.4;
    p.sol.rotation.z = -0.9 - s * 0.4;
    p.kafa.rotation.z = -s * 0.18;
    av.position.y = Math.abs(Math.cos(t * 4.4)) * 0.06;
  },

  // ---- Dalga (kollar sırayla akar) ----
  dns_08(p, t) {
    const s = Math.sin(t * 3.4);
    p.sag.rotation.z = 1.45 + Math.sin(t * 3.4) * 0.5;
    p.sol.rotation.z = -1.45 - Math.sin(t * 3.4 + Math.PI * 0.6) * 0.5;
    p.sag.rotation.x = Math.sin(t * 3.4 + 0.8) * 0.4;
    p.sol.rotation.x = Math.sin(t * 3.4 + 1.6) * 0.4;
    p.kok.rotation.z = s * 0.12;
    p.kafa.rotation.z = -s * 0.12;
  },

  // ---- Kollar havada çırpma (alkış) ----
  dns_09(p, t, av) {
    const s = Math.sin(t * 7);
    p.sag.rotation.z = 1.1 + s * 0.45;
    p.sol.rotation.z = -1.1 - s * 0.45;
    p.kollar.rotation.x = -1.1;
    av.position.y = Math.abs(Math.sin(t * 3.5)) * 0.14;
    p.kok.rotation.x = 0.08 + s * 0.05;
  },

  // ---- Çömel-kalk (kazak dansı) ----
  dns_10(p, t, av) {
    const f = (t * 1.9) % 1;
    const c = Math.max(0, Math.sin(f * Math.PI));   // çömelme derinliği
    p.kok.position.y = -c * 0.75;
    p.solBacak.rotation.x = -c * 1.2;
    p.sagBacak.rotation.x = c * 1.2;
    p.sag.rotation.z = 1.5;
    p.sol.rotation.z = -1.5;
    p.kollar.rotation.x = -1.4;
    av.position.y = 0;
  },

  // ---- Kafa sallama (rock) ----
  dns_11(p, t, av) {
    const s = Math.sin(t * 8);
    p.kafa.rotation.x = 0.45 + s * 0.4;
    p.kok.rotation.x = 0.12 + s * 0.1;
    p.sag.rotation.z = 2.3;
    p.sol.rotation.z = -2.3;
    p.sag.rotation.x = Math.sin(t * 8 + 1) * 0.25;
    av.position.y = Math.abs(Math.sin(t * 4)) * 0.1;
  },

  // ---- Kayış (moonwalk hissi) ----
  dns_12(p, t, av) {
    const s = Math.sin(t * 3.6);
    p.kok.position.x = s * 0.55;
    p.kok.rotation.z = -s * 0.14;
    p.solBacak.rotation.x = Math.sin(t * 3.6) * 0.7;
    p.sagBacak.rotation.x = -Math.sin(t * 3.6) * 0.7;
    p.sag.rotation.z = 0.75;
    p.sol.rotation.z = -0.75;
    p.kollar.rotation.x = -0.5;
    av.position.y = Math.abs(Math.cos(t * 3.6)) * 0.07;
  },

  // ---- Tek ayak fırıl (pirouette) ----
  dns_13(p, t, av) {
    p.kok.rotation.y = t * 7.5;
    p.sag.rotation.z = 2.4;
    p.sol.rotation.z = -0.6;
    p.solBacak.rotation.x = -0.9;
    p.kok.rotation.z = Math.sin(t * 7.5) * 0.06;
    av.position.y = 0.05 + Math.abs(Math.sin(t * 7.5)) * 0.08;
  },

  // ---- Zafer kupası (iki kol yukarı, gövde geriye) ----
  dns_14(p, t, av) {
    const s = Math.sin(t * 2.6);
    p.sag.rotation.z = 2.6;
    p.sol.rotation.z = -2.6;
    p.kok.rotation.x = -0.22 - s * 0.1;
    p.kok.rotation.y = Math.sin(t * 1.3) * 0.45;
    p.kafa.rotation.x = -0.2;
    av.position.y = Math.abs(s) * 0.25;
  },
};

/** Bir dans kodunun oynatıcısı var mı? */
export function dansVarMi(kod) {
  return Boolean(kod && HAREKETLER[kod]);
}

/** Avatarda dansı başlatır. Oynatıcısı yoksa hiçbir şey yapmaz. */
export function dansBaslat(avatar, kod) {
  if (!avatar?.userData || !HAREKETLER[kod]) return false;
  avatar.userData.dans = { kod, t: 0 };
  return true;
}

/** Gövdeyi duruş pozisyonuna geri alır (dans bitince / yürümeye geçince). */
export function dansiDurdur(avatar) {
  const u = avatar?.userData;
  if (!u) return;
  u.dans = null;
  const { kok, govde, kollar, bacaklar, kafa } = u;
  if (kok) { kok.rotation.set(0, 0, 0); kok.position.set(0, 0, 0); }
  if (govde) govde.rotation.set(0, 0, 0);
  if (kafa) { kafa.rotation.set(0, 0, 0); kafa.position.y = 3.05; }
  if (kollar) {
    kollar.rotation.set(0, 0, 0);
    for (const c of kollar.children) c.rotation.set(0, 0, 0);
  }
  if (bacaklar) for (const c of bacaklar.children) c.rotation.set(0, 0, 0);
  avatar.position.y = 0;
}

/**
 * Dansın bir karesini işler.
 * @returns {boolean} dans hâlâ sürüyor mu (false → yürüme animasyonu devralır)
 */
export function dansKaresi(avatar, dt) {
  const u = avatar?.userData;
  const d = u?.dans;
  if (!d) return false;
  const uygula = HAREKETLER[d.kod];
  if (!uygula) { dansiDurdur(avatar); return false; }

  d.t += dt;
  if (d.t >= DANS_SURESI) { dansiDurdur(avatar); return false; }

  // Parçalar eksikse (eski avatar yapısı) dans oynatılmaz.
  const { kok, govde, kollar, bacaklar, kafa } = u;
  if (!kok || !kollar || !bacaklar || !kafa) { dansiDurdur(avatar); return false; }
  if (kollar.children.length < 2 || bacaklar.children.length < 2) {
    dansiDurdur(avatar); return false;
  }

  // Her kare temiz duruştan başlar: hareketler birbirinin üstüne binmesin.
  kok.rotation.set(0, 0, 0); kok.position.set(0, 0, 0);
  kollar.rotation.set(0, 0, 0);
  kafa.rotation.set(0, 0, 0); kafa.position.y = 3.05;
  if (govde) govde.rotation.set(0, 0, 0);
  const sol = kollar.children[0], sag = kollar.children[1];
  const solBacak = bacaklar.children[0], sagBacak = bacaklar.children[1];
  for (const c of kollar.children) c.rotation.set(0, 0, 0);
  solBacak.rotation.set(0, 0, 0);
  sagBacak.rotation.set(0, 0, 0);
  avatar.position.y = 0;

  try {
    uygula({ kok, govde, kollar, bacaklar, kafa, sol, sag, solBacak, sagBacak }, d.t, avatar);
  } catch (e) {
    console.error("[Meydan] dans oynatilamadi:", d.kod, e);
    dansiDurdur(avatar);
    return false;
  }

  // Son yarım saniyede hareket sönümlenir: dans bitince avatar zıplamasın.
  const kalan = DANS_SURESI - d.t;
  if (kalan < 0.5) {
    const k = kalan / 0.5;
    kok.rotation.z *= k; kok.rotation.x *= k; kok.position.x *= k; kok.position.y *= k;
    avatar.position.y *= k;
  }
  return true;
}
