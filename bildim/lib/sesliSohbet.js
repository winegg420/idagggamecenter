// ============================================================
// SESLİ SOHBET — WebRTC motoru (yalnız ses, görüntü yok)
//
// Ses iki tarayıcı ARASINDA doğrudan gider; sunucuda saklanmaz, kaydedilmez.
// Sunucu yalnız "el sıkışma" mesajlarını taşır (Supabase Realtime broadcast).
//
// AKTARMA (TURN) SUNUCUSU YOK — bilinçli karar. Yalnız STUN kullanılıyor.
// Sonuç: bazı ev ağlarında/operatörlerde doğrudan bağlantı kurulamaz. Bu
// durumda sessizce takılı kalmak yerine `onDurum("basarisiz")` ile net hata
// veriyoruz (bkz. BAGLANTI_ZAMAN_ASIMI_MS).
//
// Bu dosya UI bilmez; React tarafı bildim/components/SesliSohbet.jsx.
// ============================================================

// Google'ın herkese açık STUN sunucuları (ücretsiz, yalnız adres keşfi yapar;
// ses trafiği buradan GEÇMEZ).
const STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Aktarma sunucusu olmadığı için bağlantı kurulamayabilir. 15 sn'de kurulmazsa
// kullanıcıyı belirsizlikte bırakmayıp vazgeçiyoruz.
export const BAGLANTI_ZAMAN_ASIMI_MS = 15000;

/** Tarayıcı sesli sohbeti destekliyor mu? (eski tarayıcı / güvensiz köken) */
export function destekleniyorMu() {
  try {
    return Boolean(
      typeof RTCPeerConnection !== "undefined" &&
        navigator?.mediaDevices?.getUserMedia &&
        window.isSecureContext
    );
  } catch {
    return false;
  }
}

/**
 * Mikrofon izni ister ve akışı döner.
 * MUTLAKA kullanıcı hareketinden (tıklama) sonra çağrılmalı — tarayıcı kuralı.
 * Boks/Meyve Kes kamerayı da aynı desenle açıyor.
 */
export async function mikrofonAc() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true, // hoparlörden kendi sesini duymayı engeller
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

/** getUserMedia hatasını oyuncunun anlayacağı Türkçeye çevirir. */
export function mikrofonHatasi(e) {
  const ad = String(e?.name ?? "");
  if (ad === "NotAllowedError" || ad === "SecurityError") {
    return "Mikrofon izni verilmedi. Tarayıcı adres çubuğundaki kilit simgesinden izin verebilirsin.";
  }
  if (ad === "NotFoundError" || ad === "OverconstrainedError") {
    return "Mikrofon bulunamadı. Cihazına bir mikrofon bağlı mı?";
  }
  if (ad === "NotReadableError") {
    return "Mikrofona ulaşılamadı — başka bir uygulama kullanıyor olabilir.";
  }
  return "Mikrofon açılamadı. Tekrar dene.";
}

/**
 * Bir sesli görüşme oturumu kurar.
 *
 * @param {object} p
 * @param {boolean} p.baslatan   Teklifi bu taraf mı üretecek (çakışmayı önler)
 * @param {MediaStream} p.yerelAkis  mikrofonAc() ile alınan akış
 * @param {(tur, veri) => void} p.gonder  Sinyal mesajını karşı tarafa yolla
 * @param {(durum, ayrinti) => void} p.onDurum  "baglaniyor"|"bagli"|"basarisiz"|"kapandi"
 * @param {(akis) => void} p.onUzakSes  Karşı tarafın ses akışı geldiğinde
 */
export function oturumKur({ baslatan, yerelAkis, gonder, onDurum, onUzakSes }) {
  const pc = new RTCPeerConnection({ iceServers: STUN });
  let kapandi = false;
  let zamanAsimi = null;

  // Karşı taraf henüz hazır değilken gelen ICE adayları kaybolmasın
  const bekleyenAdaylar = [];
  let uzakTanimKuruldu = false;

  const temizle = () => {
    if (kapandi) return;
    kapandi = true;
    clearTimeout(zamanAsimi);
    try {
      pc.getSenders().forEach((s) => s.track && s.track.stop());
    } catch {
      /* akış zaten kapanmış olabilir */
    }
    try {
      pc.close();
    } catch {
      /* bağlantı zaten kapalı */
    }
  };

  zamanAsimi = setTimeout(() => {
    if (kapandi) return;
    if (pc.connectionState !== "connected") {
      // Aktarma sunucusu olmadığı için bu gerçekten olabilir; net söyle.
      onDurum?.("basarisiz", "zaman_asimi");
      temizle();
    }
  }, BAGLANTI_ZAMAN_ASIMI_MS);

  try {
    yerelAkis.getTracks().forEach((t) => pc.addTrack(t, yerelAkis));
  } catch (e) {
    onDurum?.("basarisiz", "akis_eklenemedi");
    temizle();
    return { kapat: temizle, sinyalAl: () => {}, sesiKes: () => {}, pc };
  }

  pc.ontrack = (ev) => {
    try {
      onUzakSes?.(ev.streams[0]);
    } catch {
      /* UI tarafı hata verse de bağlantı yaşamalı */
    }
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      try {
        gonder("aday", ev.candidate.toJSON());
      } catch {
        /* kanal kopmuş olabilir */
      }
    }
  };

  pc.onconnectionstatechange = () => {
    if (kapandi) return;
    const d = pc.connectionState;
    if (d === "connected") {
      clearTimeout(zamanAsimi);
      onDurum?.("bagli");
    } else if (d === "failed") {
      onDurum?.("basarisiz", "ice_basarisiz");
      temizle();
    } else if (d === "disconnected") {
      // Geçici kopma olabilir; kapatmıyoruz, zaman aşımı zaten var.
      onDurum?.("baglaniyor", "kopma");
    } else if (d === "closed") {
      onDurum?.("kapandi");
    }
  };

  const adaylariBosalt = async () => {
    while (bekleyenAdaylar.length) {
      const a = bekleyenAdaylar.shift();
      try {
        await pc.addIceCandidate(a);
      } catch {
        /* geçersiz aday yok sayılır */
      }
    }
  };

  const baslat = async () => {
    if (!baslatan) return;
    try {
      const teklif = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(teklif);
      gonder("teklif", teklif);
    } catch {
      onDurum?.("basarisiz", "teklif_uretilemedi");
      temizle();
    }
  };

  /** Karşı taraftan gelen sinyal mesajını işler. */
  const sinyalAl = async (tur, veri) => {
    if (kapandi) return;
    try {
      if (tur === "teklif" && !baslatan) {
        await pc.setRemoteDescription(new RTCSessionDescription(veri));
        uzakTanimKuruldu = true;
        await adaylariBosalt();
        const cevap = await pc.createAnswer();
        await pc.setLocalDescription(cevap);
        gonder("cevap", cevap);
      } else if (tur === "cevap" && baslatan) {
        await pc.setRemoteDescription(new RTCSessionDescription(veri));
        uzakTanimKuruldu = true;
        await adaylariBosalt();
      } else if (tur === "aday") {
        const aday = new RTCIceCandidate(veri);
        if (uzakTanimKuruldu) {
          await pc.addIceCandidate(aday);
        } else {
          bekleyenAdaylar.push(aday); // sıraya al, tanım gelince uygula
        }
      }
    } catch {
      /* bozuk sinyal tek başına görüşmeyi düşürmesin */
    }
  };

  /** Mikrofonu susturur/açar (bağlantı ayakta kalır). */
  const sesiKes = (kesik) => {
    try {
      yerelAkis.getAudioTracks().forEach((t) => {
        t.enabled = !kesik;
      });
    } catch {
      /* akış kapanmış olabilir */
    }
  };

  onDurum?.("baglaniyor");
  baslat();

  return { kapat: temizle, sinyalAl, sesiKes, pc };
}
