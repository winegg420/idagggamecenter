// ============================================================
// GÖRÜNÜM KÖPRÜSÜ — profiles.gorunum ↔ 2B karakter çizimi
//
// `profiles.gorunum` (jsonb) tek kayıttır; hem profil avatarı hem liste
// avatarı buradan üretilir. İçinde iki sistem yan yana durur:
//   · eski 3B alanları (sapka, gozluk, ust, ten, sac_renk…) → meydan sahnesi
//   · yeni 2B alanları (karakter, kozmetik)                 → bütün 2B ekranlar
// Biri diğerini bozmaz; 3B harita bu dosyayı hiç bilmez.
//
// PERFORMANS: liste ekranlarında her satır için SVG üretmek pahalı.
// Üretilen data-URI, görünüm özetine göre önbelleğe alınır; aynı görünüm
// ikinci kez çizilmez. 25 satırlık lig tablosu tek geçişte kurulur.
// ============================================================

import { CHARACTERS, getCharacter } from "./karakterler.js";
import { buildCharacterSVG } from "./cizim.js";

/** Yuvalar — sıra arayüzdeki liste sırasıdır. */
export const YUVALAR = [
  { yuva: "hat", ad: "Şapka" },
  { yuva: "glasses", ad: "Gözlük" },
  { yuva: "necklace", ad: "Boyun" },
  { yuva: "wristband", ad: "Bileklik" },
  { yuva: "hair", ad: "Saç" },
  { yuva: "mustache", ad: "Bıyık" },
  { yuva: "beard", ad: "Sakal" },
  { yuva: "top", ad: "Üst Giyim" },
  { yuva: "shoes", ad: "Ayakkabı" },
];

/** Rengi olan yuvalar (bıyık ve sakal karakterin kendi rengini kullanır). */
export const RENKLI_YUVALAR = new Set([
  "hat", "glasses", "necklace", "wristband", "hair", "top", "shoes",
]);

/** Quiz Square'de kullanılan pozlar. Koşu yok: idle varsayılan. */
export const POZLAR = ["idle", "wave", "flex", "laugh"];

/** Görünüm kaydından karakter kimliği (yoksa ilk bedava karakter). */
export function karakterId(gorunum) {
  const id = gorunum?.karakter;
  return id && CHARACTERS.some((c) => c.id === id) ? id : CHARACTERS[0].id;
}

/**
 * Görünüm kaydını çizimin beklediği kozmetik nesnesine çevirir.
 * Eksik alanlar karakterin kendi varsayılan kombinasyonundan tamamlanır —
 * böylece hiç kıyafet seçmemiş oyuncu da "imza görünümüyle" çıkar.
 */
export function kozmetikCoz(gorunum) {
  const def = getCharacter(karakterId(gorunum));
  const secili = gorunum?.kozmetik;
  if (!secili || typeof secili !== "object") return def.defaultCosmetics;
  return { ...def.defaultCosmetics, ...secili };
}

// ---- data-URI önbelleği ----
// Anahtar: karakter + kozmetik + poz özeti. Görünüm değişmediği sürece
// aynı dizge döner, SVG yeniden kurulmaz.
const onbellek = new Map();
const EN_COK = 400;   // liste ekranları için fazlasıyla yeterli

function ozet(gorunum, poz) {
  const kar = karakterId(gorunum);
  const koz = kozmetikCoz(gorunum);
  let s = kar + "|" + poz;
  for (const k of Object.keys(koz).sort()) s += "|" + k + ":" + koz[k];
  return s;
}

/**
 * Avatarın `<img src>` değeri. Aynı görünüm için hep aynı dizge.
 * @param {object|null} gorunum profiles.gorunum
 * @param {string} [poz] idle | wave | flex | laugh
 */
export function avatarUri(gorunum, poz = "idle") {
  const anahtar = ozet(gorunum, poz);
  const hazir = onbellek.get(anahtar);
  if (hazir) return hazir;

  let uri;
  try {
    const def = getCharacter(karakterId(gorunum));
    const svg = buildCharacterSVG(def, kozmetikCoz(gorunum), poz);
    uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  } catch (e) {
    console.error("[Bildim] karakter cizilemedi:", e);
    return null;
  }

  // Basit tavan: en eski kayıt düşer (liste ekranlarında sınırsız büyümesin)
  if (onbellek.size >= EN_COK) onbellek.delete(onbellek.keys().next().value);
  onbellek.set(anahtar, uri);
  return uri;
}

/** Görünümde 2B karakter seçili mi? (eski hesaplarda henüz yok olabilir) */
export function karakterSecilmisMi(gorunum) {
  return Boolean(gorunum && typeof gorunum === "object" && gorunum.karakter);
}

/** Yuvanın renk alanı adı (hat → hatColor). */
export function renkAlani(yuva) {
  return yuva + "Color";
}
