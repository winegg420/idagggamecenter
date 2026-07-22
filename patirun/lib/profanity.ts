// Küfür/uygunsuz içerik filtresi — kullanıcı adı ve sohbet için.
// Liste bilinçli olarak kökler üzerinden çalışır; Türkçe karakter ve
// yaygın karakter değiştirme (a→@, i→1, o→0, s→5, e→3) normalize edilir.

const BAD_ROOTS = [
  // Türkçe
  'amk', 'aq', 'amq', 'amcik', 'amcik', 'yarrak', 'yarak', 'sik', 'sikik', 'sikim',
  'sikeyim', 'sikerim', 'sikt', 'sittir', 'orospu', 'oruspu', 'kahpe', 'pezevenk', 'pic',
  'gavat', 'ibne', 'ipne', 'göt', 'got', 'gotveren', 'am', 'amin', 'anan', 'anani',
  'sg', 'mal', 'gerizekali', 'salak', 'aptal', 'dangalak', 'yavsak', 'kevase',
  // İngilizce
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'whore', 'slut', 'nigger',
  'nigga', 'faggot', 'bastard', 'porn', 'penis', 'vagina',
];

// Kısa/riskli kökler tam kelime eşleşmesi ister; uzunlar alt dize olarak da yakalanır
const WHOLE_WORD_ONLY = new Set(['am', 'sik', 'mal', 'pic', 'got', 'aq', 'sg', 'anan']);

const CHAR_MAP: Record<string, string> = {
  '@': 'a', '4': 'a', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '3': 'e',
  ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u',
};

export function normalizeText(text: string): string {
  let out = text.toLocaleLowerCase('tr');
  for (const [from, to] of Object.entries(CHAR_MAP)) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Metinde uygunsuz içerik var mı? */
export function containsProfanity(text: string): boolean {
  const norm = normalizeText(text);
  const collapsed = norm.replace(/[^a-z]/g, ''); // boşluk/noktalamayla gizlemeyi engelle
  const words = norm.split(/[^a-z]+/).filter(Boolean);

  for (const root of BAD_ROOTS) {
    if (WHOLE_WORD_ONLY.has(root)) {
      if (words.includes(root)) return true;
    } else {
      if (collapsed.includes(root)) return true;
    }
  }
  return false;
}

/** Uygunsuz kelimeleri yıldızlar (sohbet için). */
export function maskProfanity(text: string): string {
  if (!containsProfanity(text)) return text;
  const parts = text.split(/(\s+)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || part === '') return part;
      return containsProfanity(part) ? '*'.repeat(Math.max(3, part.length)) : part;
    })
    .join('');
}

/** Kullanıcı adı doğrulama: uzunluk + karakter seti + küfür. Hata mesajı ya da null döner. */
export function validateUsername(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı';
  if (trimmed.length > 16) return 'Kullanıcı adı en fazla 16 karakter olabilir';
  if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ_]+$/.test(trimmed))
    return 'Sadece harf, rakam ve alt çizgi kullanılabilir';
  if (containsProfanity(trimmed)) return 'Bu kullanıcı adı uygun değil';
  return null;
}
