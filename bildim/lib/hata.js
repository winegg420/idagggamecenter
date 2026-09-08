// Supabase/ağ hatalarını kullanıcıya gösterilebilir Türkçe mesaja çevirir.
// HAM SQL HATASI ASLA EKRANA ÇIKMAZ (Hızlı Mod'da "column reference dogru is
// ambiguous" kullanıcıya görünmüştü — bir daha olmasın).

const BILINEN = [
  [/giriş gerekli/i, "Oturumun düşmüş görünüyor. Sayfayı yenileyip tekrar dene."],
  [/jwt|token|expired/i, "Oturumun sona erdi. Tekrar giriş yapman gerekiyor."],
  [/failed to fetch|networkerror|network request failed/i,
    "İnternet bağlantısına ulaşılamıyor. Bağlantını kontrol edip tekrar dene."],
  [/kota|çok fazla|too many/i, "Çok hızlı gidiyorsun! Biraz bekleyip tekrar dene."],
  [/soru bulunamadı/i, "Bu kategoride şu an soru yok. Başka bir kategori seç."],
  [/zaten devam eden bir maçın/i, "Bu oyuncuyla süren bir maçın zaten var."],
  [/rövanş süresi doldu/i, "Rövanş süresi doldu (24 saat)."],
  [/arkadaş/i, null], // arkadaşlıkla ilgili sunucu mesajları anlaşılır, olduğu gibi geçir
];

// Ham veritabanı/altyapı hatası kalıpları — kullanıcıya asla gösterilmez
const TEKNIK =
  /(column|relation|function|operator|syntax error|ambiguous|violates|constraint|permission denied|pgrst|duplicate key|null value)/i;

/**
 * @param {unknown} hata  Supabase error nesnesi veya Error
 * @param {string} yedek  Duruma özel varsayılan mesaj
 * @returns {string} kullanıcıya gösterilebilir Türkçe mesaj
 */
export function hataMesaji(hata, yedek = "Bir şeyler ters gitti. Tekrar dener misin?") {
  const ham = (hata?.message ?? hata?.error_description ?? String(hata ?? "")).trim();
  if (!ham) return yedek;

  for (const [kalip, karsilik] of BILINEN) {
    if (kalip.test(ham)) return karsilik ?? ham;
  }
  // Teknik hata: konsola yaz, kullanıcıya genel mesaj göster
  if (TEKNIK.test(ham)) {
    console.error("[Bildim] teknik hata:", ham);
    return yedek;
  }
  // Sunucunun kendi Türkçe iş kuralı mesajları (raise exception) olduğu gibi
  return ham.length <= 140 ? ham : yedek;
}
