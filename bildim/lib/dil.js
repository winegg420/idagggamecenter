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
    "Quiz Square'de gerçek adın hiçbir zaman gösterilmez. Diğer oyuncular yalnızca burada seçtiğin takma adı görür.":
      "Your real name is never shown on Quiz Square. Other players only see the nickname you choose here.",
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
