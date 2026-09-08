// Google H5 Games Ads (AdSense for Games — Ad Placement API) sarmalayıcısı.
//
// NEDEN AdMob DEĞİL: AdMob yalnızca yerel (native) uygulamalar içindir; web ve
// TWA'da çalışmaz. Web/TWA'da ödüllü video için desteklenen yol H5 Games Ads'tir.
//
// Betik yalnız `VITE_H5_ADS_CLIENT` doluysa yüklenir. Boşsa TEST MODU: reklam
// gösterilmez, buton pasif kalır ve SAHTE ÖDÜL VERİLMEZ.

const ISTEMCI = import.meta.env.VITE_H5_ADS_CLIENT ?? "";
let yukleniyor = null;

export function h5AdsYapilandirildi() {
  return Boolean(ISTEMCI);
}

/** Ad Placement API betiğini bir kez yükler. */
export function h5AdsYukle() {
  if (!ISTEMCI) return Promise.reject(new Error("Reklam yapılandırılmamış"));
  if (typeof window === "undefined") return Promise.reject(new Error("Tarayıcı yok"));
  if (window.adBreak) return Promise.resolve();
  if (yukleniyor) return yukleniyor;

  yukleniyor = new Promise((coz, red) => {
    try {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.dataset.adClient = ISTEMCI;
      s.dataset.adfrequencyHint = "30s";
      s.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
        encodeURIComponent(ISTEMCI);
      s.onload = () => {
        // adBreak/adConfig, betik yüklendikten sonra tanımlanır
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak =
          window.adBreak || ((o) => window.adsbygoogle.push(o));
        window.adConfig =
          window.adConfig || ((o) => window.adsbygoogle.push(o));
        coz();
      };
      s.onerror = () => red(new Error("Reklam betiği yüklenemedi"));
      document.head.appendChild(s);
    } catch (e) {
      red(e);
    }
  }).catch((e) => {
    yukleniyor = null;
    throw e;
  });

  return yukleniyor;
}

/**
 * Ödüllü video gösterir.
 * Çözülürse { izlendi: true } döner — ÖDÜL SUNUCUDA verilir (reklam_odulu_al).
 * Reklam yüklenemez/gösterilemezse reddedilir; sahte ödül üretilmez.
 */
export function odulluVideoGoster() {
  if (!ISTEMCI) return Promise.reject(new Error("Reklam yapılandırılmamış"));

  return h5AdsYukle().then(
    () =>
      new Promise((coz, red) => {
        let odulVerildi = false;
        let bitti = false;

        const kapat = (hata) => {
          if (bitti) return;
          bitti = true;
          if (hata) red(hata);
          else if (odulVerildi) coz({ izlendi: true });
          else red(new Error("Reklam tamamlanmadı"));
        };

        try {
          window.adBreak({
            type: "reward",
            name: "joker-odulu",
            beforeReward: (gosterOdulluReklam) => {
              // Reklam hazır: hemen göster
              try {
                gosterOdulluReklam();
              } catch (e) {
                kapat(e);
              }
            },
            adDismissed: () => kapat(new Error("Reklam kapatıldı")),
            adViewed: () => {
              odulVerildi = true;
              kapat();
            },
            adBreakDone: (yer) => {
              // beforeReward hiç çağrılmadıysa reklam yoktu
              if (!odulVerildi && yer?.breakStatus !== "viewed") {
                kapat(new Error("Şu an gösterilecek reklam yok"));
              }
            },
          });
        } catch (e) {
          kapat(e);
        }

        // Güvenlik ağı: 60 sn içinde sonuç yoksa reddet
        setTimeout(() => kapat(new Error("Reklam zaman aşımına uğradı")), 60000);
      })
  );
}
