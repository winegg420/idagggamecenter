// ============================================================
// ARAYÜZ DİLİ — AŞAMA 1 (giriş ekranları)
//
// Kütüphane YOK (i18next ve benzeri yasak): düz JS nesnesi + `t()`.
//
// KAPSAM: bu aşamada yalnız yeni oyuncunun İLK gördüğü ekranlar çevrildi —
// `src/pages/Login.jsx` ve `bildim/components/KurulumSihirbazi.jsx`.
// Kalan 100+ dosya Aşama 2. Sözlükte olmayan anahtar Türkçe metnin
// kendisine düşer (`t()` anahtarı aynen döndürür), böylece yarım çeviri
// boş ekran üretmez.
//
// DİL KURALI — SIRALI, IP'YE BAKILMAZ:
//   1. Giriş yapmış oyuncunun profilindeki tercih (`profiles.dil`)
//   2. Oyuncunun bu tarayıcıda elle seçtiği dil (localStorage)
//   3. Tarayıcı/telefon dili: `tr` ile başlıyorsa Türkçe, başka her şey İngilizce
// Ülke/IP KULLANILMAZ: Almanya'daki Türk Türkçe, Türkiye'deki yabancı
// İngilizce görmeli. Tarayıcı dili bunu doğru yapar, ülke yanlış yapar.
// ============================================================

export const DILLER = ["tr", "en"];
const ANAHTAR = "bildim_dil";

/** Tarayıcı dili → desteklenen dil. `tr-TR`, `tr` → tr; başka her şey → en. */
export function tarayiciDili() {
  try {
    const liste = Array.isArray(navigator?.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator?.language];
    for (const d of liste) {
      if (typeof d === "string" && d.toLowerCase().startsWith("tr")) return "tr";
    }
  } catch {
    /* eski tarayıcı: aşağıdaki varsayılana düş */
  }
  return "en";
}

/** Bu tarayıcıda elle seçilmiş dil (yoksa null). */
export function kayitliDil() {
  try {
    const d = localStorage.getItem(ANAHTAR);
    return DILLER.includes(d) ? d : null;
  } catch {
    return null;   // gizli sekme / depolama kapalı
  }
}

/** Elle seçimi bu tarayıcıya yazar. */
export function dilKaydet(dil) {
  if (!DILLER.includes(dil)) return;
  try { localStorage.setItem(ANAHTAR, dil); } catch { /* depolama kapalı */ }
}

/**
 * Geçerli dili SIRALI KURALLA çözer.
 * @param {{dil?: string}|null} profil giriş yapmış oyuncunun profili
 */
export function dilCoz(profil) {
  const p = profil?.dil;
  if (DILLER.includes(p)) return p;
  return kayitliDil() ?? tarayiciDili();
}

// ------------------------------------------------------------------ sözlük
// Anahtar = TÜRKÇE metnin kendisi. Böylece çevirisi yazılmamış bir metin
// Türkçe görünür, "kayıp anahtar" gibi teknik bir şey değil.
const SOZLUK = {
  en: {
    // ---- Giriş ekranı (Login.jsx) ----
    "Her gün 13:00 ve 21:50'de (Türkiye saati) büyük turnuva.":
      "Big tournament every day at 13:00 and 21:50 (Türkiye time).",
    "7/24 meydan okumalar. Sen de yerini al.":
      "Challenges around the clock. Take your place.",
    "Google ile devam et": "Continue with Google",
    "Facebook ile devam et": "Continue with Facebook",
    "X (Twitter) ile devam et": "Continue with X (Twitter)",
    "Yönlendiriliyor…": "Redirecting…",
    "Giriş yapılıyor…": "Signing in…",
    "Gönderiliyor…": "Sending…",
    "veya": "or",
    "hesap açmadan": "without an account",
    "E-posta adresin": "Your email address",
    "E-posta ile giriş bağlantısı al": "Get a sign-in link by email",
    "Misafir olarak dene": "Try as a guest",
    "Gizlilik politikası": "Privacy policy",
    "Kullanım koşulları": "Terms of use",
    "Dil": "Language",

    // Giriş hataları ve bilgilendirmeler
    "{ad} girişi şu an kapalı. Google veya e-posta ile devam edebilirsin.":
      "{ad} sign-in is currently closed. You can continue with Google or email.",
    "Misafir girişi şu an kapalı. Google veya e-posta ile devam edebilirsin.":
      "Guest sign-in is currently closed. You can continue with Google or email.",
    "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.":
      "Too many attempts. Please try again in a few minutes.",
    "Giriş adresi doğrulanamadı. Sayfayı yenileyip tekrar dene.":
      "The sign-in address could not be verified. Refresh the page and try again.",
    "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.":
      "Could not connect. Check your internet connection and try again.",
    "Giriş yapılamadı. Tekrar dene.": "Sign-in failed. Please try again.",
    "Facebook girişi henüz açılmadı. Google veya e-posta ile devam edebilirsin.":
      "Facebook sign-in is not open yet. You can continue with Google or email.",
    "Giriş bağlantısı {eposta} adresine gönderildi. E-postanı kontrol et.":
      "A sign-in link was sent to {eposta}. Please check your email.",
    "Misafir hesabı bu cihaza bağlıdır. Puanların kaybolmasın diye daha sonra {liste} veya e-posta hesabını bağlayabilirsin.":
      "A guest account is tied to this device. To keep your points, you can link {liste} or an email account later.",

    // ---- Kurulum sihirbazı (KurulumSihirbazi.jsx) ----
    "Kurulum": "Setup",
    "Kendine bir takma ad seç": "Choose a nickname",
    "Quiz Tactics'te gerçek adın hiçbir zaman gösterilmez. Diğer oyuncular yalnızca burada seçtiğin takma adı görür.":
      "Your real name is never shown on Quiz Tactics. Other players only see the nickname you choose here.",
    "Takma ad (3-16 karakter)": "Nickname (3-16 characters)",
    "ör. BilgeKartal": "e.g. WiseEagle",
    "Harf, rakam ve alt çizgi kullanabilirsin. Sonradan günde bir kez değiştirilebilir.":
      "You can use letters, numbers and underscores. It can be changed once a day later on.",
    "Kaydediliyor…": "Saving…",
    "Devam": "Continue",
    "Takma ad kaydedilemedi.": "The nickname could not be saved.",
    "Avatarını seç": "Choose your avatar",
    "Hazır bir avatar seç ya da Google fotoğrafını kullanmayı onayla. Onaylamazsan fotoğrafın kimseye gösterilmez.":
      "Pick a ready-made avatar or approve using your Google photo. If you do not approve, your photo is shown to no one.",
    "{ad} avatarını seç": "Choose the {ad} avatar",
    "Bu avatarı kullan": "Use this avatar",
    "Google fotoğrafımı kullan": "Use my Google photo",
    "Avatarsız devam et": "Continue without an avatar",
    "Avatar kaydedilemedi.": "The avatar could not be saved.",
    "Hangi şehir için yarışıyorsun?": "Which city are you competing for?",
    "Şehir ve ülke liglerinde bu bilgiyle yarışırsın. Günde yalnızca bir kez değiştirebilirsin.":
      "This is what places you in the city and country leagues. You can change it only once a day.",
    "Ülke": "Country",
    "Şehir": "City",
    "Şehrini yaz": "Type your city",
    "— Seç —": "— Select —",
    "Şehir seçmelisin.": "You must select a city.",
    "Oyuna başla": "Start playing",
    "Konum kaydedilemedi.": "Your location could not be saved.",
    "Ülke listesi yüklenemedi.": "The country list could not be loaded.",
    "Şehir listesi yüklenemedi.": "The city list could not be loaded.",

    // Avatar adları (sihirbazdaki ipucu metinleri)
    "Kedi": "Cat", "Köpek": "Dog", "Baykuş": "Owl", "Tilki": "Fox",
    "Panda": "Panda", "Penguen": "Penguin", "Kurbağa": "Frog", "Ayı": "Bear",
    "Maymun": "Monkey", "Dinozor": "Dinosaur", "Ejderha": "Dragon",
    "Köpekbalığı": "Shark", "Ahtapot": "Octopus", "Arı": "Bee",
    "Robot": "Robot", "Uzaylı": "Alien", "Astronot": "Astronaut",
    "Ninja": "Ninja", "Korsan": "Pirate", "Şövalye": "Knight",
    "Büyücü": "Wizard", "Dedektif": "Detective", "Aşçı": "Chef",
    "Profesör": "Professor", "Viking": "Viking", "Hayalet": "Ghost",
    "Zombi": "Zombie", "Mumya": "Mummy", "Kahraman": "Hero",
    "Palyaço": "Clown", "Kral": "King",

    // ---- Paket 14: Dereceli/Serbest, ödüller, arkadaş maçı ----
    "Dereceli": "Ranked",
    "Lig puanı + tam coin": "League points + full coins",
    "Serbest — puan yok, coin yarı": "Casual — no points, half coins",
    "Normal Maç — kazanırsan lig puanı ve coin": "Normal Match — win for league points and coins",
    "Serbest maç — keyfine bak, hiçbir şey kaybetmezsin": "Casual match — just have fun, you lose nothing",
    "Dereceli: doğru başına +{dogru} lig puanı ve coin (en çok {tavan}).":
      "Ranked: +{dogru} league points and coins per correct answer (up to {tavan}).",
    "Serbest: lig puanı yok, coin yarı.": "Casual: no league points, half coins.",
    "+{puan} lig puanı": "+{puan} league points",
    "+{coin} coin": "+{coin} coins",
    "Arkadaş maçı — ödül ve puan yok.": "Friendly match — no rewards or points.",

    // ---- Paket 14: Düello (Taktik Maçı) ----
    "Düello": "Duel",
    "Taktik Maçı": "Tactics Match",
    "Sırayla birbirinize soru gönderin. Rakibin zayıf kategorisini bul, oradan vur.":
      "Take turns sending each other questions. Find your opponent's weak category and strike there.",
    "3 can, en çok 10 tur": "3 lives, up to 10 rounds",
    "Rakip en zayıf kategorisinde bilirse canı SEN kaybedersin":
      "If your opponent answers correctly in their weakest category, YOU lose a life",
    "Aynı kategori üst üste seçilemez, maçta en çok 2 kez":
      "The same category can't be picked twice in a row, and at most twice per match",
    "Galibiyet: +50 lig puanı ve 50 coin": "Win: +50 league points and 50 coins",
    "Rakip ara": "Find opponent",
    "Rakip aranıyor": "Searching for an opponent",
    "Düello rakibi aranıyor…": "Searching for a duel opponent…",
    "Rakip aranamadı. Bağlantını kontrol edip tekrar dene.": "Couldn't search for an opponent. Check your connection and try again.",
    "Düello yüklenemedi.": "The duel couldn't be loaded.",
    "Vazgeç": "Cancel",
    "Düello'ya dön": "Back to Duel",
    "Bu oyuncuyla {ben}-{rakip} öndesin": "You lead this player {ben}-{rakip}",
    "Bu oyuncuyla {ben}-{rakip} geridesin": "You trail this player {ben}-{rakip}",
    "Bu oyuncuyla {ben}-{rakip} berabersiniz": "You're tied with this player {ben}-{rakip}",
    "Düello iptal edildi": "Duel cancelled",
    "Kazandın!": "You won!",
    "Kaybettin": "You lost",
    "Rövanşa git": "Go to rematch",
    "Rövanş isteği gönderildi, rakip bekleniyor…": "Rematch requested, waiting for your opponent…",
    "{ad} rövanş istiyor!": "{ad} wants a rematch!",
    "Kabul et": "Accept",
    "Reddet": "Decline",
    "Rövanş": "Rematch",
    "Yeni düello": "New duel",
    "Ana sayfa": "Home",
    "Saldırı kategorini seç": "Pick your attack category",
    "Rakibinin kategori başarısı. Kırmızı çerçeve: en zayıf kategorisi — bilirse canı sen kaybedersin.":
      "Your opponent's category accuracy. Red frame: their weakest category — if they get it right, you lose a life.",
    "riskli": "risky",
    "veri yok": "no data",
    "{ad} saldırı kategorisini seçiyor…": "{ad} is picking an attack category…",
    "Saldırı Hazırlığı": "Attack Prep",
    "Soruyu gör, istersen saldırı jokeri kullan. Süre dolunca soru rakibe gider.":
      "See the question and use an attack joker if you like. When time is up, it goes to your opponent.",
    "{kategori} saldırısı geliyor!": "{kategori} attack incoming!",
    "Savun!": "Defend!",
    "{ad} düşünüyor…": "{ad} is thinking…",
    "Zaman Baskısı: cevap süresi 10 saniye": "Time Pressure: 10 seconds to answer",
    "Rakip bu soruda savunma jokeri kullanamaz": "Your opponent can't use defense jokers on this question",
    "En zayıf kategorin! Bilirsen saldıran can kaybeder.": "Your weakest category! Answer correctly and the attacker loses a life.",
    "Altın Soru": "Golden Question",
    "Cevabın kilitlendi. Rakip bekleniyor…": "Answer locked. Waiting for your opponent…",
    "Can ve doğru sayısı eşit. Tek doğru bilen kazanır — joker yok.":
      "Lives and correct answers are tied. Only one correct answer wins — no jokers.",
    "Tur": "Round",
    "Serbest": "Casual",
    "Düellodan çıkarsan hükmen kaybedersin. Emin misin?": "If you leave the duel, you forfeit. Are you sure?",
    "Çık": "Leave",
    "Düellodan çık": "Leave duel",
    "Riskli saldırı geri tepti — sen can kaybettin!": "The risky attack backfired — you lost a life!",
    "En zayıf kategorinde savuşturdun — rakip can kaybetti!": "You fended it off in your weakest category — your opponent lost a life!",
    "Savuşturdun!": "Fended off!",
    "Rakip saldırıyı savuşturdu.": "Your opponent fended off the attack.",
    "Süre doldu — can kaybettin.": "Time's up — you lost a life.",
    "Rakibin süresi doldu — can kaybetti!": "Your opponent ran out of time — they lost a life!",
    "Yanlış — can kaybettin.": "Wrong — you lost a life.",
    "İsabet! Rakip can kaybetti.": "Hit! Your opponent lost a life.",
    "Saldırı jokerleri": "Attack jokers",
    "Savunma jokerleri": "Defense jokers",
    "ücretsiz": "free",
    "50:50": "50:50",
    "Ek Süre": "Extra Time",
    "Soru Değiştir": "Swap Question",
    "İki yanlış şık silinir": "Removes two wrong options",
    "Cevap süresine 5 saniye ekler": "Adds 5 seconds to answer",
    "Aynı kategoriden başka soru gelir": "Brings another question from the same category",
    "Zaman Baskısı": "Time Pressure",
    "Savunma Kilidi": "Defense Lock",
    "Rakibin cevap süresi 15 sn'den 10 sn'ye düşer": "Cuts your opponent's answer time from 15 s to 10 s",
    "Aynı kategoriden başka bir soru gönderir": "Sends a different question from the same category",

    // Kategori profili ve unvanlar
    "Hiç maç yapmadı, istatistiği yok": "No matches played, no stats yet",
    "{mac} maç · {istatistikli} maçın istatistiği": "{mac} matches · stats from {istatistikli} matches",
    "Henüz kategori istatistiği yok": "No category stats yet",
    "Bilgin": "Scholar", "Bilim Kurdu": "Science Buff", "Tarihçi": "Historian", "Kâşif": "Explorer",
    "Kitap Kurdu": "Bookworm", "Sporsever": "Sports Fan", "Sanatsever": "Art Lover",
    "Sinemasever": "Cinephile", "Müziksever": "Music Lover", "Teknoloji Dahisi": "Tech Wizard",
    "Genel Kültür": "General Knowledge", "Bilim": "Science", "Tarih": "History", "Coğrafya": "Geography",
    "Edebiyat": "Literature", "Spor": "Sports", "Sanat": "Art", "Sinema": "Cinema", "Müzik": "Music",
    "Teknoloji": "Technology",

    // Düello sunucu mesajları
    "Bu kategori şu an seçilemez": "This category can't be picked right now",
    "Şu an kategori seçme sırası sende değil": "It's not your turn to pick a category",
    "Saldırı jokerleri yalnız Saldırı Hazırlığı sırasında kullanılır": "Attack jokers can only be used during Attack Prep",
    "Bu joker bu saldırıda zaten kullanıldı": "This joker was already used in this attack",
    "Yeni gelen soru ikinci kez değiştirilemez": "The new question can't be swapped again",
    "Yetersiz joker": "Not enough jokers",
    "Savunma jokerleri yalnız cevap verirken kullanılır": "Defense jokers can only be used while answering",
    "Bu soruda 50:50 zaten kullanıldı": "50:50 was already used on this question",
    "Bu soruda Ek Süre zaten kullanıldı": "Extra Time was already used on this question",
    "Bu maçta soruyu bir kez değiştirebilirsin": "You can swap the question once per match",
    "Kendi saldırını cevaplayamazsın": "You can't answer your own attack",
    "Bu soruyu zaten cevapladın": "You already answered this question",
    "Şu an cevap verilemez": "You can't answer right now",
    "Düello bitti": "The duel is over",
    "Düello henüz bitmedi": "The duel isn't over yet",
    "Rövanş isteğinin süresi doldu": "The rematch request expired",
    "Oyunculardan birinin devam eden düellosu var": "One of the players already has a duel in progress",
    "Şu an uygun rakip yok, birazdan tekrar dene.": "No opponent available right now, try again shortly.",
    "Bu kategoride başka soru kalmadı": "No other questions left in this category",
    "Düello bulunamadı": "Duel not found",
    "Bu düelloda değilsin": "You're not in this duel",
    "Bir şeyler ters gitti. Tekrar dener misin?": "Something went wrong. Could you try again?",

    // Maç sonu sesli sohbet (5.1)
    "Sesli sohbet {sn} sn sonra kapanacak": "Voice chat closes in {sn} s",
    "Şimdi kapat": "Close now",
  },
};

/**
 * Çeviri. Anahtar Türkçe metnin kendisidir; sözlükte yoksa aynen döner.
 * @param {string} dil "tr" | "en"
 * @param {string} anahtar Türkçe metin
 * @param {Record<string,string|number>} [degerler] {ad} gibi yer tutucular
 */
export function t(dil, anahtar, degerler) {
  const metin = (dil !== "tr" && SOZLUK[dil]?.[anahtar]) || anahtar;
  if (!degerler) return metin;
  return metin.replace(/\{(\w+)\}/g, (tam, ad) =>
    Object.prototype.hasOwnProperty.call(degerler, ad) ? String(degerler[ad]) : tam
  );
}

/** Bir dile bağlı `t` üretir: `const ceviri = tYap(dil)`. */
export function tYap(dil) {
  return (anahtar, degerler) => t(dil, anahtar, degerler);
}
