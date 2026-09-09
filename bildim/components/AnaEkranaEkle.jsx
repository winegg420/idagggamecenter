import { useEffect, useState } from "react";
import Logo from "./Logo.jsx";

// ============================================================
// iPhone / iPad — "Ana Ekrana Ekle" yönlendirmesi
//
// NEDEN VAR: Kurulum önerisini tetikleyen `beforeinstallprompt` olayını iOS
// Safari desteklemiyor (Apple otomatik banner'ı iOS 12.2'de kaldırdı). Yani
// Android'de Chrome kendi kurulum kutusunu gösterirken iPhone kullanıcısı
// hiçbir davet almıyor; Paylaş → Ana Ekrana Ekle adımlarını kendi bilmek
// zorunda kalıyor. Bu bileşen o boşluğu kapatır: adımları bir kez gösterir.
//
// GÖSTERİLME KOŞULLARI (hepsi sağlanmalı):
//   1. Cihaz iOS (iPhone/iPad — iPadOS 13+ kendini "MacIntel" diye tanıtır)
//   2. Tarayıcı Safari — "Ana Ekrana Ekle" yalnız Safari'de var. Chrome/Firefox
//      ya da Instagram/Facebook içi tarayıcıda menü yok, göstermek kafa karıştırır
//   3. Uygulama zaten ana ekrandan açılmamış (navigator.standalone)
//   4. Kullanıcı daha önce kapatmamış (localStorage)
//
// Kapatınca bir daha çıkmaz. localStorage erişilemezse (gizli sekme, çerez
// engeli) yalnız o oturum boyunca gizlenir — hata vermez.
// ============================================================

const ANAHTAR = "quizador_ana_ekran_kapatildi";
const GECIKME_MS = 2500; // sayfa otursun, kapıda karşılamasın

/** Cihaz iPhone/iPad mi? iPadOS 13+ masaüstü Safari gibi davranır. */
function iosMu() {
  try {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+: platform "MacIntel" ama dokunmatik nokta sayısı > 1
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  } catch {
    return false;
  }
}

/** Gerçek Safari mi? (Chrome/Firefox/Edge/Opera ve uygulama içi tarayıcılar hariç) */
function safariMi() {
  try {
    const ua = navigator.userAgent || "";
    // iOS'ta tüm tarayıcılar WebKit; ayırt etmek yalnız UA ile mümkün.
    if (/crios|fxios|edgios|opios|yabrowser|duckduckgo/i.test(ua)) return false;
    // Uygulama içi tarayıcılar (Instagram, Facebook, X, LinkedIn): menü yok
    if (/fban|fbav|fb_iab|instagram|line\/|twitter|linkedinapp|micromessenger/i.test(ua))
      return false;
    return /safari/i.test(ua);
  } catch {
    return false;
  }
}

/** Uygulama zaten ana ekrandan mı açıldı? */
function kuruluMu() {
  try {
    if (navigator.standalone === true) return true;
    return window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  } catch {
    return false;
  }
}

function dahaOnceKapatildi() {
  try {
    return localStorage.getItem(ANAHTAR) === "1";
  } catch {
    return false; // depoya erişilemiyorsa göstermeyi engelleme
  }
}

/** Safari'nin paylaş ikonu — kutudan yukarı çıkan ok. */
function PaylasIkonu({ boyut = 20 }) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />
    </svg>
  );
}

/** Ana ekrana ekleme adımındaki artı kutusu. */
function ArtiKutuIkonu({ boyut = 20 }) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export default function AnaEkranaEkle() {
  const [gorunur, setGorunur] = useState(false);
  const [kapaniyor, setKapaniyor] = useState(false);

  useEffect(() => {
    if (!iosMu() || !safariMi() || kuruluMu() || dahaOnceKapatildi()) return undefined;

    const z = setTimeout(() => setGorunur(true), GECIKME_MS);
    return () => clearTimeout(z);
  }, []);

  // Kart sayfanın altına oturuyor; altta kalan içeriği (misafir düğmesi,
  // yasal linkler) kapatmasın diye gövdeye yer açtırıyoruz.
  useEffect(() => {
    if (!gorunur) return undefined;
    try {
      document.body.classList.add("bd-ekle-acik");
    } catch {
      /* belge yoksa düzen zaten çizilmiyor */
    }
    return () => {
      try {
        document.body.classList.remove("bd-ekle-acik");
      } catch {
        /* sayfa kapanıyor olabilir */
      }
    };
  }, [gorunur]);

  const kapat = () => {
    setKapaniyor(true);
    try {
      localStorage.setItem(ANAHTAR, "1");
    } catch {
      /* gizli sekme: yalnız bu oturumda gizli kalır */
    }
    // Kapanış animasyonu bitince DOM'dan çıkar
    setTimeout(() => setGorunur(false), 220);
  };

  if (!gorunur) return null;

  return (
    <div
      className={`bd-ekle-katman ${kapaniyor ? "kapaniyor" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Uygulamayı ana ekrana ekle"
    >
      <div className="bd-ekle">
        <button className="bd-ekle-kapat" onClick={kapat} aria-label="Kapat">
          ×
        </button>

        <div className="bd-ekle-ust">
          <img
            src="/bildim-icon-192.png"
            alt=""
            width="52"
            height="52"
            className="bd-ekle-ikon"
            aria-hidden="true"
          />
          <div className="bd-ekle-basliklar">
            <div className="bd-ekle-baslik">
              <Logo boyut={19} />
            </div>
            <div className="bd-ekle-alt">
              Uygulama gibi kullan — tam ekran açılır, tarayıcı çubuğu olmaz.
            </div>
          </div>
        </div>

        <ol className="bd-ekle-adimlar">
          {/* "Aşağıdaki" denmiyor: paylaş düğmesi iOS 15+ varsayılanında alt
              çubukta, ama "Tek Sekme" ayarında ve yatay modda sağ ÜSTTE.
              Konum vaat etmek yerine ikonu gösteriyoruz. */}
          <li>
            Safari'nin <PaylasIkonu /> <b>Paylaş</b> düğmesine dokun
          </li>
          <li>
            Listeden <ArtiKutuIkonu /> <b>Ana Ekrana Ekle</b>'yi seç
          </li>
          <li>
            Sağ üstten <b>Ekle</b>'ye bas — kısayol ana ekranında
          </li>
        </ol>

        {/* .btn kullanılmıyor: o kural `.app` altında tanımlı, giriş ekranında
            `.app` sarmalayıcısı yok — düğme stilsiz kalırdı. */}
        <button className="bd-ekle-tamam" onClick={kapat}>
          Anladım
        </button>
      </div>
    </div>
  );
}
