import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDil } from "../lib/dilKanca.js";
import { supabase } from "../../src/lib/supabase.js";
import Ikon from "./Ikon.jsx";
import {
  destekleniyorMu,
  mikrofonAc,
  mikrofonHatasi,
  oturumKur,
} from "../lib/sesliSohbet.js";
import { tt } from "../lib/dil.js";

// ============================================================
// MAÇ İÇİ SESLİ SOHBET (yalnız 1v1, yalnız arkadaşlar)
//
// KURALLAR
//  • Ses iki tarayıcı ARASINDA doğrudan gider; sunucuda saklanmaz, KAYDEDİLMEZ.
//  • İki taraf da açıkça kabul etmeden bağlantı kurulmaz (karşılıklı onay).
//  • Rakip o an maçta değilse düğme hiç görünmez — kimseye boşuna çağrı gitmez.
//  • İzin kuralı sunucuda: sesli_sohbet_izni RPC (arkadaşlık + maç + bot kontrolü).
//
// AKTARMA SUNUCUSU YOK: bazı ağlarda bağlantı kurulamaz. Sessizce takılmak
// yerine 15 sn sonra net hata gösteriliyor.
// ============================================================

// Durumlar: kapali → cagriliyor/cagri_geldi → izin → baglaniyor → bagli
const DURUMLAR = {
  KAPALI: "kapali",
  CAGRILIYOR: "cagriliyor", // ben davet ettim, cevap bekliyorum
  CAGRI_GELDI: "cagri_geldi", // rakip davet etti, karar bekliyorum
  BAGLANIYOR: "baglaniyor",
  BAGLI: "bagli",
};

/**
 * @param {object} o
 * @param {string} o.macId
 * @param {string} o.benimId
 * @param {HTMLElement|null} [o.yuva]  arayüzün çizileceği yer (verilmezse yerinde çizilir)
 * @param {boolean} [o.macBitti]       maç bitti mi — bitince görüşme mac_sonu_sesli_sn kadar sürer
 */
export default function SesliSohbet({ macId, benimId, yuva, macBitti = false }) {
  const { ceviri } = useDil();
  // Maç bitince kapanma anı (istemci saati, ms). Sunucudan kalan saniyeyle kurulur.
  const [kapanisAn, setKapanisAn] = useState(null);
  const [simdi, setSimdi] = useState(Date.now());
  const [izin, setIzin] = useState(null); // sunucudan: { izinli, neden, rakip_id }
  const [rakipBurada, setRakipBurada] = useState(false);
  const [durum, setDurum] = useState(DURUMLAR.KAPALI);
  const [hata, setHata] = useState(null);
  const [sesKesik, setSesKesik] = useState(false);
  const [bilgiAcik, setBilgiAcik] = useState(false);

  const kanalRef = useRef(null);
  const oturumRef = useRef(null);
  const akisRef = useRef(null);
  const sesElemaniRef = useRef(null);
  const durumRef = useRef(DURUMLAR.KAPALI);

  // Olay dinleyicileri kapanış üzerinden eski durumu okumasın
  useEffect(() => {
    durumRef.current = durum;
  }, [durum]);

  // ---- Sunucudan izin kontrolü (arkadaş mı, maç aktif mi, bot mu) ----
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("sesli_sohbet_izni", {
          p_match_id: macId,
        });
        if (error) throw error;
        const s = Array.isArray(data) ? data[0] : data;
        if (!iptal) setIzin(s ?? null);
      } catch {
        // Migration henüz uygulanmadıysa özellik sessizce gizlenir; maç bozulmaz.
        if (!iptal) setIzin(null);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [macId]);

  const kapat = useCallback(
    (sebep) => {
      try {
        oturumRef.current?.kapat();
      } catch {
        /* zaten kapalı */
      }
      oturumRef.current = null;
      try {
        akisRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* akış zaten durmuş */
      }
      akisRef.current = null;
      if (sesElemaniRef.current) sesElemaniRef.current.srcObject = null;
      setDurum(DURUMLAR.KAPALI);
      setSesKesik(false);
      if (sebep) setHata(sebep);
    },
    []
  );

  const yayinla = useCallback((tur, veri) => {
    try {
      kanalRef.current?.send({
        type: "broadcast",
        event: "ses",
        payload: { tur, veri, kimden: benimId },
      });
    } catch {
      /* kanal kopmuş olabilir */
    }
  }, [benimId]);

  const oturumBaslat = useCallback(
    async (baslatan) => {
      setHata(null);
      let akis;
      try {
        akis = await mikrofonAc();
      } catch (e) {
        setDurum(DURUMLAR.KAPALI);
        setHata(mikrofonHatasi(e));
        yayinla("kapat", null); // karşı taraf boşuna beklemesin
        return;
      }
      akisRef.current = akis;
      setDurum(DURUMLAR.BAGLANIYOR);
      oturumRef.current = oturumKur({
        baslatan,
        yerelAkis: akis,
        gonder: yayinla,
        onDurum: (d, ayrinti) => {
          if (d === "bagli") {
            setDurum(DURUMLAR.BAGLI);
            setHata(null);
          } else if (d === "basarisiz") {
            kapat(
              ayrinti === "zaman_asimi" || ayrinti === "ice_basarisiz"
                ? tt("Ses bağlantısı kurulamadı. Ev ağlarınız doğrudan bağlanmaya izin vermiyor olabilir — yazılı sohbeti kullanabilirsiniz.")
                : tt("Sesli sohbet başlatılamadı. Tekrar dene.")
            );
            yayinla("kapat", null);
          }
        },
        onUzakSes: (uzakAkis) => {
          if (sesElemaniRef.current) {
            sesElemaniRef.current.srcObject = uzakAkis;
            sesElemaniRef.current.play?.().catch(() => {
              /* otomatik oynatma engellenirse kullanıcı zaten tıklamıştı */
            });
          }
        },
      });
    },
    [kapat, yayinla]
  );

  // ---- Maç bitti: sunucudan kalan süreyi al, geri say, süre dolunca kapat ----
  useEffect(() => {
    if (!macBitti) return undefined;
    let iptal = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("sesli_sohbet_izni", { p_match_id: macId });
        if (error) throw error;
        const s = Array.isArray(data) ? data[0] : data;
        if (iptal) return;
        if (!s?.izinli) { setKapanisAn(Date.now()); return; }
        setKapanisAn(Date.now() + Math.max(0, Number(s.kapanis_sn ?? 0)) * 1000);
      } catch (e) {
        console.error("[Bildim] mac sonu sesli sohbet suresi alinamadi:", e);
        if (!iptal) setKapanisAn(Date.now());
      }
    })();
    return () => { iptal = true; };
  }, [macBitti, macId]);

  useEffect(() => {
    if (!kapanisAn) return undefined;
    const t = setInterval(() => setSimdi(Date.now()), 500);
    return () => clearInterval(t);
  }, [kapanisAn]);

  const kalanSn = kapanisAn ? Math.max(0, Math.ceil((kapanisAn - simdi) / 1000)) : null;
  useEffect(() => {
    if (kalanSn !== 0) return;
    // Süre doldu: görüşmeyi kapat, karşı tarafa bildir, düğmeyi gizle
    try {
      kanalRef.current?.send({ type: "broadcast", event: "ses", payload: { tur: "kapat", veri: null, kimden: benimId } });
    } catch {
      /* kanal kopmuş olabilir */
    }
    kapat();
    setIzin(null);
  }, [kalanSn, kapat, benimId]);

  // ---- Realtime: varlık (rakip burada mı) + sinyalleşme ----
  useEffect(() => {
    if (!izin?.izinli) return undefined;

    const kanal = supabase.channel(`mac-ses-${macId}`, {
      config: { presence: { key: benimId } },
    });
    kanalRef.current = kanal;

    kanal
      .on("presence", { event: "sync" }, () => {
        try {
          const durumlar = kanal.presenceState();
          const baskasiVar = Object.keys(durumlar).some((k) => k !== benimId);
          setRakipBurada(baskasiVar);
          // Rakip maçtan çıktıysa görüşmeyi düşür
          if (!baskasiVar && durumRef.current !== DURUMLAR.KAPALI) {
            kapat(tt("Rakibin maçtan ayrıldı."));
          }
        } catch {
          /* presence okunamadıysa düğme gizli kalır */
        }
      })
      .on("broadcast", { event: "ses" }, ({ payload }) => {
        if (!payload || payload.kimden === benimId) return;
        const { tur, veri } = payload;

        if (tur === "davet") {
          if (durumRef.current === DURUMLAR.KAPALI) {
            setHata(null);
            setDurum(DURUMLAR.CAGRI_GELDI);
          }
          return;
        }
        if (tur === "kabul") {
          // Daveti ben göndermiştim; teklifi ben üretirim (çakışma olmasın)
          if (durumRef.current === DURUMLAR.CAGRILIYOR) oturumBaslat(true);
          return;
        }
        if (tur === "red") {
          if (durumRef.current === DURUMLAR.CAGRILIYOR) {
            setDurum(DURUMLAR.KAPALI);
            setHata(tt("Rakibin sesli sohbeti kabul etmedi."));
          }
          return;
        }
        if (tur === "kapat") {
          if (durumRef.current !== DURUMLAR.KAPALI) kapat(tt("Sesli sohbet kapandı."));
          return;
        }
        // teklif / cevap / aday → WebRTC motoruna
        oturumRef.current?.sinyalAl(tur, veri);
      })
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          try {
            await kanal.track({ girdi: Date.now() });
          } catch {
            /* varlık bildirilemezse düğme gizli kalır, maç etkilenmez */
          }
        }
      });

    return () => {
      try {
        kanal.unsubscribe();
      } catch {
        /* zaten kapalı */
      }
      supabase.removeChannel(kanal);
      kanalRef.current = null;
      kapat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izin?.izinli, macId, benimId]);

  // Sayfa kapanırken mikrofon açık kalmasın
  useEffect(() => () => kapat(), [kapat]);

  // ---- Görünürlük kararı ----
  // Sunucu izin vermediyse (arkadaş değil / bot / maç bitti) hiç çizilmez.
  if (!izin?.izinli) return null;
  if (!destekleniyorMu()) return null;

  const cagirt = () => {
    setHata(null);
    setDurum(DURUMLAR.CAGRILIYOR);
    yayinla("davet", null);
  };
  const kabulEt = () => {
    yayinla("kabul", null);
    oturumBaslat(false); // teklifi karşı taraf üretir
  };
  const reddet = () => {
    yayinla("red", null);
    setDurum(DURUMLAR.KAPALI);
  };
  const bitir = () => {
    yayinla("kapat", null);
    kapat();
  };

  const arayuz = (
    <div className="bd-ses">
      {macBitti && kalanSn !== null && kalanSn > 0 && (
        <div className="bd-ses-geri-sayim" role="timer">
          <span>{ceviri("Sesli sohbet {sn} sn sonra kapanacak", { sn: kalanSn })}</span>
          {durum !== DURUMLAR.KAPALI && (
            <button className="bd-ses-kucuk tehlike" onClick={() => { bitir(); setIzin(null); }}>
              {ceviri("Şimdi kapat")}
            </button>
          )}
        </div>
      )}

      {durum === DURUMLAR.KAPALI && (
        <>
          <button
            className="bd-ses-dugme"
            onClick={cagirt}
            disabled={!rakipBurada}
            title={
              rakipBurada
                ? tt("Sesli sohbet başlat")
                : tt("Rakibin şu an maçta değil — geldiğinde açılır")
            }
          >
            <Ikon ad="mikrofon" boyut={18} />
            <span>{rakipBurada ? tt("Sesli sohbet") : tt("Rakibin yok")}</span>
          </button>
          <button
            className="bd-ses-bilgi-dugme"
            onClick={() => setBilgiAcik((a) => !a)}
            aria-label={tt("Sesli sohbet nasıl çalışır?")}
            title={tt("Sesli sohbet nasıl çalışır?")}
          >
            ?
          </button>
        </>
      )}

      {durum === DURUMLAR.CAGRILIYOR && (
        <div className="bd-ses-durum">
          <span className="bd-ses-nokta" aria-hidden="true" />
          {tt("Cevap bekleniyor…")}
          <button className="bd-ses-kucuk" onClick={bitir}>
            {tt("Vazgeç")}
          </button>
        </div>
      )}

      {durum === DURUMLAR.CAGRI_GELDI && (
        <div className="bd-ses-cagri">
          <div className="bd-ses-cagri-metin">
            <b>{tt("Sesli sohbet daveti")}</b>
            <span>{tt("Kabul edersen mikrofonun açılır. Konuşma kaydedilmez.")}</span>
          </div>
          <button className="bd-ses-kabul" onClick={kabulEt}>
            {tt("Kabul et")}
          </button>
          <button className="bd-ses-kucuk" onClick={reddet}>
            {tt("Reddet")}
          </button>
        </div>
      )}

      {durum === DURUMLAR.BAGLANIYOR && (
        <div className="bd-ses-durum">
          <span className="bd-ses-nokta" aria-hidden="true" />
          {tt("Bağlanıyor…")}
          <button className="bd-ses-kucuk" onClick={bitir}>
            {tt("İptal")}
          </button>
        </div>
      )}

      {durum === DURUMLAR.BAGLI && (
        <div className="bd-ses-durum bagli">
          <span className="bd-ses-nokta canli" aria-hidden="true" />
          {tt("Sesli sohbet açık")}
          <button
            className="bd-ses-kucuk"
            onClick={() => {
              const yeni = !sesKesik;
              setSesKesik(yeni);
              oturumRef.current?.sesiKes(yeni);
            }}
          >
            {sesKesik ? tt("Sesi aç") : tt("Sustur")}
          </button>
          <button className="bd-ses-kucuk tehlike" onClick={bitir}>
            {tt("Kapat")}
          </button>
        </div>
      )}

      {hata && <div className="bd-ses-hata" role="alert">{hata}</div>}

      {bilgiAcik && (
        <div className="bd-ses-bilgi">
          {tt("Ses")} <b>{tt("doğrudan iki cihaz arasında")}</b> {tt("gider; sunucularımızda saklanmaz ve")} <b>{tt("kaydedilmez")}</b>{tt(". Bağlantı kurulurken cihazlarınızın IP adresleri karşı tarafa görünebilir — bu yüzden yalnız arkadaşlarınla açılır. İstediğin an kapatabilirsin.")}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Karşı tarafın sesi: ekran dalı değişse de SÖKÜLMEZ (görüşme sürer) */}
      <audio ref={sesElemaniRef} autoPlay playsInline />
      {yuva === undefined ? arayuz : yuva ? createPortal(arayuz, yuva) : null}
    </>
  );
}
