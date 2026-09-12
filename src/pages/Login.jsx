import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import Logo from "../../bildim/components/Logo.jsx";
import { girisHedefiniKaydet } from "../lib/girisHedefi.js";

// Supabase'in İngilizce hata metinlerini oyuncuya anlaşılır Türkçeye çevirir.
// Sağlayıcı panelde kapalıysa dönen mesaj ("provider is not enabled") teknik
// kaçıyordu; oyuncu düğmenin bozuk olduğunu sanıyordu.
function girisHatasi(e, saglayiciAd) {
  const m = String(e?.message ?? e ?? "");
  if (/provider is not enabled|Unsupported provider/i.test(m)) {
    return `${saglayiciAd} girişi şu an kapalı. Google veya e-posta ile devam edebilirsin.`;
  }
  if (/Anonymous sign-ins are disabled/i.test(m)) {
    return "Misafir girişi şu an kapalı. Google veya e-posta ile devam edebilirsin.";
  }
  if (/rate limit|too many/i.test(m)) {
    return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  }
  if (/redirect|not allowed/i.test(m)) {
    return "Giriş adresi doğrulanamadı. Sayfayı yenileyip tekrar dene.";
  }
  if (/network|fetch|Failed to fetch/i.test(m)) {
    return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
  }
  return m || "Giriş yapılamadı. Tekrar dene.";
}

const SAGLAYICI_AD = {
  google: "Google",
  facebook: "Facebook",
  twitter: "X (Twitter)",
};

// Hangi sosyal düğmeler gösterilecek?
//
// supabase-js signInWithOAuth sağlayıcıyı DOĞRULAMADAN tarayıcıyı Supabase'e
// yönlendirir. Sağlayıcı panelde kapalıysa oyuncu uygulamadan çıkıp ham JSON
// hata sayfasında ("Unsupported provider") kalıyordu — yukarıdaki Türkçe hata
// çevirisi hiç çalışmıyor, çünkü hata istemciye dönmüyor.
// Bu yüzden kapalı sağlayıcının düğmesi hiç basılmaz. X/Meta anahtarları
// Supabase'e girilince .env'e `VITE_SOSYAL=google,facebook,twitter` yaz;
// düğmeler geri gelir. Kod silinmedi, yalnız kapıya bağlandı.
const ACIK_SAGLAYICILAR = new Set(
  String(import.meta.env.VITE_SOSYAL ?? "google,facebook")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Sağlayıcı Supabase panelinde AÇIK MI? Auth'un herkese açık `settings`
// ucundan öğreniliyor. Böylece kapalı bir sağlayıcıya basan oyuncu ham
// JSON hata sayfasına düşmüyor, Türkçe mesaj görüyor.
async function acikSaglayicilariOku() {
  try {
    const kok = import.meta.env.VITE_SUPABASE_URL;
    if (!kok) return null;
    const yanit = await fetch(`${kok}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
    });
    if (!yanit.ok) return null;
    const veri = await yanit.json();
    return veri?.external ?? null;
  } catch (e) {
    console.error("[Bildim] saglayici listesi okunamadi:", e);
    return null;   // bilinmiyor: düğmeler eskisi gibi çizilir
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState(null);
  const [bekleyen, setBekleyen] = useState(null); // hangi düğme çalışıyor
  // Supabase'de gerçekten açık olan sağlayıcılar (null = henüz bilinmiyor)
  const [acikListe, setAcikListe] = useState(null);

  useEffect(() => {
    let aktif = true;
    acikSaglayicilariOku().then((d) => { if (aktif) setAcikListe(d); });
    return () => { aktif = false; };
  }, []);

  /** Düğme çizilsin mi? Panelden bilgi gelmediyse .env kararı geçerli. */
  const saglayiciAcik = (ad) =>
    acikListe ? Boolean(acikListe[ad]) : ACIK_SAGLAYICILAR.has(ad);

  const sosyalGiris = async (provider) => {
    setHata(null);
    setBekleyen(provider);
    // Supabase izin listesi redirectTo'yu reddederse Site URL'ine düşer;
    // hedefi burada saklarız ki derin bağlantı kaybolmasın.
    girisHedefiniKaydet();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Girişten sonra kullanıcı geldiği sayfaya dönsün (davet linki vb.)
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          // X ve Facebook e-posta iznini ayrıca ister; istemezsek profil adı boş kalır.
          //
          // `user_friends` App Review ONAYI ister. Onay gelmeden istenirse
          // Facebook girişi hata verir, o yüzden varsayılan olarak İSTENMEZ.
          // Onay geldiğinde .env'e VITE_FB_ARKADAS=1 yazmak yeterli:
          // izin istenir ve arkadaş önerisi bölümü kendiliğinden dolar.
          scopes:
            provider === "facebook"
              ? (import.meta.env.VITE_FB_ARKADAS === "1"
                  ? "public_profile,email,user_friends"
                  : "public_profile,email")
              : undefined,
        },
      });
      if (error) throw error;
    } catch (e) {
      setHata(girisHatasi(e, SAGLAYICI_AD[provider] ?? provider));
    } finally {
      setBekleyen(null);
    }
  };

  // Misafir girişi: Supabase anonim oturumu. Profil tetikleyicisi e-postası
  // olmayan kullanıcıya da "oyuncu_xxxx" takma adı üretir; oyuncu daha sonra
  // sosyal hesap bağlayarak kalıcı hesaba geçebilir.
  const misafirGiris = async () => {
    setHata(null);
    setBekleyen("misafir");
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (e) {
      setHata(girisHatasi(e, "Misafir"));
    } finally {
      setBekleyen(null);
    }
  };

  const epostaGiris = async (e) => {
    e.preventDefault();
    setHata(null);
    setBekleyen("eposta");
    girisHedefiniKaydet();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setGonderildi(true);
    } catch (err) {
      setHata(girisHatasi(err, "E-posta"));
    } finally {
      setBekleyen(null);
    }
  };

  return (
    <div className="giris">
      <div className="buyuk-logo"><Logo boyut={44} /></div>
      <div className="slogan">
        Her gün 13:00 ve 21:50'de (Türkiye saati) büyük turnuva.
        <br />
        7/24 meydan okumalar. Sen de yerini al.
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}

      <button
        className="sosyal-btn"
        disabled={bekleyen !== null}
        onClick={() => sosyalGiris("google")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        {bekleyen === "google" ? "Yönlendiriliyor…" : "Google ile devam et"}
      </button>
      {saglayiciAcik("facebook") && (
      <button
        className="sosyal-btn"
        disabled={bekleyen !== null}
        onClick={() => sosyalGiris("facebook")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"/></svg>
        {bekleyen === "facebook" ? "Yönlendiriliyor…" : "Facebook ile devam et"}
      </button>
      )}
      {saglayiciAcik("twitter") && (
      <button
        className="sosyal-btn"
        disabled={bekleyen !== null}
        onClick={() => sosyalGiris("twitter")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.31l-7.23 8.26L22.83 21.75h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.17 2.25h6.83l4.72 6.24 5.52-6.24zm-1.16 17.52h1.83L7.02 4.13H5.06l12.02 15.64z"/></svg>
        {bekleyen === "twitter" ? "Yönlendiriliyor…" : "X (Twitter) ile devam et"}
      </button>
      )}

      <div className="ayrac">veya</div>

      {gonderildi ? (
        <div className="kart" style={{ maxWidth: 340, textAlign: "center" }}>
          Giriş bağlantısı <b>{email}</b> adresine gönderildi. E-postanı kontrol et.
        </div>
      ) : (
        <form onSubmit={epostaGiris} style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="E-posta adresin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn ikincil" disabled={bekleyen !== null}>
            {bekleyen === "eposta" ? "Gönderiliyor…" : "E-posta ile giriş bağlantısı al"}
          </button>
        </form>
      )}

      <div className="ayrac">hesap açmadan</div>

      <button
        className="sosyal-btn"
        disabled={bekleyen !== null}
        onClick={misafirGiris}
      >
        {bekleyen === "misafir" ? "Giriş yapılıyor…" : "Misafir olarak dene"}
      </button>
      <div className="giris-not">
        Misafir hesabı bu cihaza bağlıdır. Puanların kaybolmasın diye daha sonra
        {" "}
        {/* Kapalı sağlayıcıyı vaat etmeyelim: metin açık düğmelerden üretilir. */}
        {[...ACIK_SAGLAYICILAR].map((s) => SAGLAYICI_AD[s] ?? s).join(", ")} veya
        e-posta hesabını bağlayabilirsin.
      </div>

      {/* Yasal metinler giriş duvarının ÖNÜNDE erişilebilir olmalı
          (Google Play ve reklam ağları şartı). */}
      <div className="giris-yasal">
        <a href="/gizlilik">Gizlilik politikası</a>
        <span aria-hidden="true">·</span>
        <a href="/kosullar">Kullanım koşulları</a>
      </div>
    </div>
  );
}
