// ============================================================
// GÖLGE BOKS — oyun ekranı
// Kamera (tek akış) + poz takibi (TEK model) + canvas render döngüsü + HUD +
// mola arası round analizi + sonuç/kayıt akışı.
//
// Kamera/model getUserMedia jesti gerektirdiği için "Başla" butonuyla başlatılır
// (aynı jestte tam ekran, wake lock ve ses motoru da açılır).
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBoks } from "../BoksApp.jsx";
import { Kamera } from "../../engine/kamera.js";
import { PozTakip } from "../../engine/posetakip.js";
import { Oyun, MODLAR, ZORLUKLAR } from "../../engine/oyun.js";
import { ciz, koordinatHesap } from "../../engine/render.js";
import {
  sesBaslat,
  sesCal,
  sesAcKapa,
  sesDurdur,
  kocAcKapa,
  kocKisilikAyarla,
  kocOlay,
  kocSustur,
} from "../../engine/ses.js";
import {
  roundAnalizi,
  oturumAnalizi,
  zayiflikTespit,
  zorlukOnerisi,
} from "../../engine/antrenorAnalizi.js";
import { rozetKontrol } from "../../engine/ilerleme.js";
import { KlipKaydedici } from "../../engine/paylasim.js";
import { oturumKaydet, kariyerOnbellek, programDurum, programGunTamamla, tercihKaydet } from "../../lib/depo.js";

export default function OyunPage() {
  const { mod, zorluk } = useParams();
  const git = useNavigate();
  const { tercih, profile } = useBoks();
  const gecerliMod = MODLAR[mod] ? mod : "serbest";
  const gecerliZorluk = ZORLUKLAR[zorluk] ? zorluk : "orta";
  const test = gecerliZorluk === "test";

  const canvasRef = useRef(null);
  const kameraRef = useRef(null);
  const pozRef = useRef(null);
  const oyunRef = useRef(null);
  const rafRef = useRef(0);
  const sonZamanRef = useRef(0);
  const wakeRef = useRef(null);
  const bittiRef = useRef(false);
  const ctxRef = useRef(null);
  const kaliteRef = useRef(1);
  const fpsRef = useRef({ ema: 16, olcum: 0 });
  const algilamaRef = useRef({ poz: -1, t: 0, pozHz: 0 });
  const klipRef = useRef(null);
  const hudRef = useRef(0);
  const molaRaporRef = useRef(0);

  const [durum, setDurum] = useState("hazir"); // hazir | baslatiliyor | oynaniyor | hata
  const [hata, setHata] = useState("");
  const [sesAcik, setSesAcik] = useState(tercih.ses_acik !== false);
  const [kocAcik, setKoc] = useState(tercih.koc_acik !== false);
  const [uyari, setUyari] = useState(null);
  const [molaRapor, setMolaRapor] = useState(null);
  const [sonuc, setSonuc] = useState(null);
  const [kayit, setKayit] = useState("");
  // Klip kaydı MediaRecorder ile asenkron biter; blob hazır olunca butonu göster.
  const [klipVar, setKlipVar] = useState(false);
  const [hud, setHud] = useState({
    faz: "isinma", fazSure: 10, round: 1, puan: 0, combo: 0, tempo: 0,
    pozVar: false, pozHz: 0, gecikmeMs: 0, yol: "", kalibre: true,
    komut: null, komutIdx: 0, kapsam: "",
  });

  // ---------------- oturum kaydı ----------------
  const oturumuKaydet = useCallback(
    async (oyun) => {
      setKayit("kaydediliyor");
      const toplam = oyun.toplamIstatistik();
      const kal = oyun.kalori(toplam);
      const rapor = oturumAnalizi(toplam, { mod: gecerliMod, zorluk: gecerliZorluk, durus: tercih.durus });
      const zayif = zayiflikTespit(toplam, rapor.vektor);
      const onbellek = kariyerOnbellek();
      const rozetler = rozetKontrol(toplam, {
        zorluk: gecerliZorluk,
        mod: gecerliMod,
        kariyer: onbellek?.kariyer || {},
        seriGun: (onbellek?.kariyer?.seri_gun || 0) + 1,
        kalori: kal.deger,
      });
      const paket = {
        mod: gecerliMod,
        zorluk: gecerliZorluk,
        ozet: {
          puan: toplam.puan,
          toplamYumruk: toplam.toplamYumruk,
          isabet: toplam.isabet,
          kacirma: toplam.kacirma,
          sure: Math.round(toplam.sure),
          kalori: kal.deger,
          ortSiddet: Math.round(toplam.siddetToplam / Math.max(1, toplam.toplamYumruk)),
          siddetMax: toplam.siddetMax,
          enIyiCombo: toplam.enIyiCombo,
          stilKod: rapor.arketip?.kod || null,
          eslesenDovuscu: rapor.eslesme?.[0]?.ad || null,
        },
        roundlar: oyun.roundlar,
        zayifliklar: zayif.map((z) => ({ kod: z.kod, olcum: z.olcum })),
        rozetler,
      };

      let sonucDb = null;
      try {
        const r = await oturumKaydet(paket);
        sonucDb = r;
        setKayit(r.ok ? "kaydedildi" : "kuyrukta");
      } catch (e) {
        console.error("[Boks] Kayıt hatası:", e);
        setKayit("hata");
      }

      // Seviye testi → önerilen zorluğu tercihe yaz.
      if (test) {
        try {
          const oneri = zorlukOnerisi(toplam);
          await tercihKaydet({ onerilen_zorluk: oneri.zorluk });
          rapor.oneri = oneri;
        } catch (e) {
          console.warn("[Boks] Zorluk önerisi hesaplanamadı:", e?.message || e);
        }
      }

      // Program günü ilerlemesi (yerel)
      try {
        const pd = programDurum();
        if (pd.kod && !test) programGunTamamla();
      } catch {
        /* yerel kayıt yoksa sorun değil */
      }

      const paketRapor = {
        rapor,
        toplam,
        kalori: kal,
        roundlar: oyun.roundlar,
        mod: gecerliMod,
        zorluk: gecerliZorluk,
        durus: tercih.durus,
        rozetler,
        yeniRozetler: sonucDb?.sonuc?.yeni_rozetler || [],
        seriGun: sonucDb?.sonuc?.seri_gun || null,
        ad: profile?.username || "Oyuncu",
        tarih: Date.now(),
      };
      try {
        sessionStorage.setItem("boks_son_rapor", JSON.stringify(paketRapor));
      } catch {
        /* sessionStorage kapalıysa rapor sayfası boş açılır */
      }
      setSonuc(paketRapor);
    },
    [gecerliMod, gecerliZorluk, tercih.durus, test, profile],
  );

  // ---------------- ana döngü ----------------
  const dongu = useCallback(() => {
    const canvas = canvasRef.current;
    const oyun = oyunRef.current;
    const poz = pozRef.current;
    const kamera = kameraRef.current;
    if (!canvas || !oyun || !kamera || !poz) return;

    const simdi = performance.now();
    let dt = (simdi - sonZamanRef.current) / 1000;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    sonZamanRef.current = simdi;

    // Adaptif çözünürlük (zayıf cihazda netlik ↓, akıcılık ↑). Eşikler akıcılık
    // lehine sıkılaştırıldı: 45 fps'in altına düşen her saniye çözünürlüğü
    // kırpar, 58 fps'i geçince kademeli geri açar.
    const ft = fpsRef.current;
    ft.ema = ft.ema * 0.9 + Math.min(dt * 1000, 100) * 0.1;
    ft.olcum += dt;
    if (ft.olcum > 1) {
      ft.olcum = 0;
      if (ft.ema > 22 && kaliteRef.current > 0.45) kaliteRef.current = Math.max(0.45, kaliteRef.current - 0.15);
      else if (ft.ema < 17.2 && kaliteRef.current < 1) kaliteRef.current = Math.min(1, kaliteRef.current + 0.1);
      // Cihaz zorlanıyorsa çıkarım karesi de küçülür: worker hızlanır, gecikme
      // düşer ve poz akışı seyrelmez (yumruk ıskalanmaz).
      poz.kaliteAyarla?.(kaliteRef.current);
    }

    // algılama frekansı teşhisi
    const ar = algilamaRef.current;
    if (simdi - ar.t > 1000) {
      if (ar.poz >= 0) ar.pozHz = Math.round(((poz.damga - ar.poz) * 1000) / (simdi - ar.t));
      ar.poz = poz.damga;
      ar.t = simdi;
    }

    // tampon boyutu (dpr tavanı + piksel bütçesi)
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    // dpr tavanı 1.5 → 1.4, bütçe 900k → 820k: kamera görüntüsü zaten 640×360
    // kaynaktan geliyor, fazla piksel netlik katmıyor; akıcılığa katkısı ölçülür.
    let olcek = Math.min(window.devicePixelRatio || 1, 1.4) * kaliteRef.current;
    const butce = 820000;
    if (W * H * olcek * olcek > butce) olcek = Math.sqrt(butce / (W * H));
    const bw = Math.max(1, Math.round(W * olcek));
    const bh = Math.max(1, Math.round(H * olcek));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      ctxRef.current = ctx;
    }
    ctx.setTransform(bw / W, 0, 0, bw / W, 0, 0);

    const k = koordinatHesap(kamera.video, W, H);
    oyun.guncelle(dt, {
      pozHam: poz.poz,
      damga: poz.damga,
      // Boru hattı gecikmesi motorda telafi edilir (nişan + çizim senkronu).
      gecikme: poz.gecikmeSn,
      harita: k.esle,
      W,
      H,
    });
    ciz(ctx, oyun, kamera.video, k, W, H, { kalite: kaliteRef.current });

    // ---- ses olayları ----
    if (oyun.sesler.length) {
      const sayac = {};
      for (const s of oyun.sesler) {
        sayac[s] = (sayac[s] || 0) + 1;
        if (sayac[s] <= 2) sesCal(s);
      }
      if (oyun.sesler.some((s) => s.startsWith("vurus"))) {
        try {
          navigator.vibrate?.(14);
        } catch {
          /* titreşim desteklenmiyor */
        }
      }
      oyun.sesler.length = 0;
    }
    // ---- sesli koç ----
    if (oyun.konusmalar.length) {
      for (const o of oyun.konusmalar) kocOlay(o);
      oyun.konusmalar.length = 0;
    }
    // ---- sağlık/güvenlik uyarıları ----
    if (oyun.uyarilar.length) {
      const u = oyun.uyarilar.shift();
      oyun.uyarilar.length = 0;
      setUyari(u);
      setTimeout(() => setUyari(null), 5200);
    }

    // ---- en iyi combo klibi ----
    const klip = klipRef.current;
    if (klip && oyun.combo >= 5 && oyun.faz === "round") {
      klip.baslat(canvas, 4, oyun.combo);
    }

    // ---- HUD (en fazla ~7 fps, yalnız değişince) ----
    if (simdi - hudRef.current > 140) {
      hudRef.current = simdi;
      const kapsam = oyun.tanima.kapsam;
      const y = {
        faz: oyun.faz,
        fazSure: Math.ceil(oyun.fazSure),
        round: oyun.roundNo,
        puan: oyun.puan,
        combo: oyun.combo,
        tempo: oyun.tempoAnlik,
        pozVar: !!oyun.poz,
        pozHz: ar.pozHz,
        gecikmeMs: Math.round((poz.gecikmeSn || 0) * 1000),
        yol: poz.yol,
        kalibre: oyun.tanima.kalibreEdiliyor,
        komut: oyun.komut ? oyun.komut.dizi.join("-") : null,
        komutIdx: oyun.komut ? oyun.komut.indeks : 0,
        kapsam: kapsam.bacaklar ? "tam" : kapsam.kalca ? "govde" : kapsam.ustGovde ? "ust" : "yok",
      };
      setHud((e) => {
        for (const a in y) if (e[a] !== y[a]) return y;
        return e;
      });
    }

    // ---- mola: round analizi göster ----
    if (oyun.faz === "mola" && molaRaporRef.current !== oyun.roundNo) {
      molaRaporRef.current = oyun.roundNo;
      const son = oyun.roundlar[oyun.roundlar.length - 1];
      if (son) {
        try {
          setMolaRapor({
            no: oyun.roundlar.length,
            rapor: roundAnalizi(son, { mod: gecerliMod, zorluk: gecerliZorluk, durus: tercih.durus }),
          });
        } catch (e) {
          console.warn("[Boks] Round analizi üretilemedi:", e?.message || e);
        }
      }
    }
    // (Mola raporu ayrıca gizlenmez: gösterim koşulu HUD fazına bağlıdır,
    //  round başlayınca kendiliğinden kaybolur.)

    // ---- antrenman bitti ----
    if (oyun.bitti && !bittiRef.current) {
      bittiRef.current = true;
      klipRef.current?.durdur();
      kocSustur();
      oturumuKaydet(oyun);
      // MediaRecorder 'onstop' bir sonraki tick'te blob'u yazar.
      setTimeout(() => setKlipVar(!!klipRef.current?.blob), 700);
    }

    rafRef.current = requestAnimationFrame(dongu);
  }, [gecerliMod, gecerliZorluk, tercih, oturumuKaydet]);

  // ---------------- başlat ----------------
  const baslat = useCallback(async () => {
    setDurum("baslatiliyor");
    setHata("");
    try {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch {
        /* iOS Safari desteklemeyebilir */
      }
      try {
        if ("wakeLock" in navigator) wakeRef.current = await navigator.wakeLock.request("screen");
      } catch {
        /* yut */
      }

      sesBaslat();
      sesAcKapa(sesAcik);
      kocAcKapa(kocAcik);
      kocKisilikAyarla(tercih.koc_kisilik);

      const kamera = new Kamera();
      await kamera.baslat();
      kameraRef.current = kamera;

      // TEK model: yalnız poz takibi kurulur (el modeli kaldırıldı — el ölçeği
      // poz landmark'larından okunuyor). Hem açılış hem çalışma yükü yarı yarıya.
      const poz = new PozTakip();
      await poz.baslat(kamera);
      pozRef.current = poz;

      const kariyer = kariyerOnbellek()?.kariyer || null;
      const hedefTempo =
        kariyer && kariyer.toplam_sure > 60
          ? Math.round((kariyer.toplam_yumruk / (kariyer.toplam_sure / 60)) * 1)
          : 0;

      oyunRef.current = new Oyun({
        mod: gecerliMod,
        zorluk: gecerliZorluk,
        durus: tercih.durus,
        kiloKg: tercih.kilo_kg || 0,
        hedefTempo,
      });
      klipRef.current = new KlipKaydedici();
      bittiRef.current = false;
      molaRaporRef.current = 0;
      setSonuc(null);
      setMolaRapor(null);
      setKayit("");
      sonZamanRef.current = performance.now();
      setDurum("oynaniyor");
      rafRef.current = requestAnimationFrame(dongu);
    } catch (e) {
      console.error("[Boks] Başlatma hatası:", e);
      setHata(e?.message || "Antrenman başlatılamadı.");
      setDurum("hata");
      pozRef.current?.durdur();
      kameraRef.current?.durdur();
      pozRef.current = null;
      kameraRef.current = null;
    }
  }, [gecerliMod, gecerliZorluk, tercih, sesAcik, kocAcik, dongu]);

  const temizle = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    klipRef.current?.durdur();
    kocSustur();
    pozRef.current?.durdur();
    kameraRef.current?.durdur();
    pozRef.current = null;
    kameraRef.current = null;
    sesDurdur();
    try {
      wakeRef.current?.release?.();
    } catch {
      /* yut */
    }
    wakeRef.current = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => temizle, [temizle]);

  useEffect(() => {
    const gorunur = async () => {
      if (document.visibilityState === "visible" && durum === "oynaniyor" && "wakeLock" in navigator) {
        try {
          wakeRef.current = await navigator.wakeLock.request("screen");
        } catch {
          /* yut */
        }
      }
    };
    document.addEventListener("visibilitychange", gorunur);
    return () => document.removeEventListener("visibilitychange", gorunur);
  }, [durum]);

  const cik = () => {
    // Erken çıkışta biriken round verisi yine de kaydedilir.
    const oyun = oyunRef.current;
    if (oyun && !bittiRef.current && oyun.roundlar.length > 0) {
      bittiRef.current = true;
      oyun.bitir();
      oturumuKaydet(oyun).catch(() => {});
    }
    temizle();
    git("/boks");
  };

  const tekrar = () => {
    const kariyer = kariyerOnbellek()?.kariyer || null;
    const hedefTempo =
      kariyer && kariyer.toplam_sure > 60 ? Math.round(kariyer.toplam_yumruk / (kariyer.toplam_sure / 60)) : 0;
    oyunRef.current = new Oyun({
      mod: gecerliMod,
      zorluk: gecerliZorluk,
      durus: tercih.durus,
      kiloKg: tercih.kilo_kg || 0,
      hedefTempo,
    });
    klipRef.current?.temizle();
    bittiRef.current = false;
    molaRaporRef.current = 0;
    setKlipVar(false);
    setSonuc(null);
    setMolaRapor(null);
    setKayit("");
    sonZamanRef.current = performance.now();
  };

  const fazAd =
    hud.faz === "isinma" ? "ISINMA" : hud.faz === "mola" ? "MOLA" : hud.faz === "round" ? `ROUND ${hud.round}` : "";

  return (
    <div className="bx-oyun-root">
      <canvas ref={canvasRef} className="bx-canvas" />

      {durum === "hazir" && (
        <div className="bx-katman bx-hazir">
          <button className="bx-x" onClick={() => git("/boks")}>✕</button>
          <div className="bx-hazir-kart">
            <span className="bx-logo">{MODLAR[gecerliMod].ikon}</span>
            <h2>{MODLAR[gecerliMod].ad} · {ZORLUKLAR[gecerliZorluk].ad}</h2>
            <p>{MODLAR[gecerliMod].aciklama}</p>
            <ul className="bx-kontrol-liste">
              <li>🧯 <b>Alan kontrolü:</b> kolunun uzanacağı mesafede eşya veya insan olmasın.</li>
              <li>🎥 <b>Kadraj:</b> 1,5-2 m geri git; kafan ve iki omzun görünsün.</li>
              <li>🥊 <b>Duruş:</b> {tercih.durus === "guney_pence" ? "Güney pençe (sağ el önde)" : "Ortodoks (sol el önde)"} — menüden değiştirebilirsin.</li>
              {test && <li>📏 <b>Seviye testi:</b> 30 saniye serbest çalış, sistem sana uygun zorluğu önersin.</li>}
            </ul>
            <button className="bx-btn bx-btn-ana bx-genis" onClick={baslat}>📷 Kamerayı Aç ve Başla</button>
          </div>
        </div>
      )}

      {durum === "baslatiliyor" && (
        <div className="bx-katman bx-yukleniyor">
          <div className="bx-spinner" />
          <p>Kamera ve vücut takibi hazırlanıyor…</p>
          <small>İlk açılışta model indirilir (yaklaşık 6 MB), sonraki açılışlar hızlıdır.</small>
        </div>
      )}

      {durum === "hata" && (
        <div className="bx-katman bx-hata">
          <span className="bx-hata-emoji">📷</span>
          <p>{hata}</p>
          <div className="bx-hata-btnler">
            <button className="bx-btn bx-btn-ana" onClick={baslat}>Tekrar Dene</button>
            <button className="bx-btn bx-btn-ikincil" onClick={() => git("/boks")}>Geri Dön</button>
          </div>
        </div>
      )}

      {durum === "oynaniyor" && (
        <>
          <button className="bx-x" onClick={cik}>✕</button>
          <div className="bx-ust-btnler">
            <button className="bx-mini" onClick={() => setSesAcik(sesAcKapa(!sesAcik))}>
              {sesAcik ? "🔊" : "🔇"}
            </button>
            <button className="bx-mini" onClick={() => setKoc(kocAcKapa(!kocAcik))} title="Sesli koç">
              {kocAcik ? "🗣️" : "🤐"}
            </button>
          </div>

          <div className="bx-hud-ust">
            <div className={"bx-faz " + (hud.faz === "round" ? "aktif" : "")}>
              {fazAd}
              <span className="bx-faz-sure">{hud.fazSure}</span>
            </div>
            <div className="bx-puan">{hud.puan}</div>
          </div>

          {hud.combo >= 3 && hud.faz === "round" && (
            <div className="bx-combo">🔥 SERİ x{hud.combo}</div>
          )}

          {hud.komut && (
            <div className="bx-komut">
              {hud.komut.split("-").map((n, i) => (
                <span key={i} className={"bx-komut-no" + (i === hud.komutIdx ? " aktif" : i < hud.komutIdx ? " tamam" : "")}>
                  {n}
                </span>
              ))}
            </div>
          )}

          {/* takip teşhisi — ıskalama/kasma şikâyetinde ilk bakılacak yer */}
          <div className={"bx-takip " + (hud.pozVar ? "var" : "yok")}>
            {hud.pozVar ? "🧍 takip aktif" : "🧍 vücut görünmüyor"}
            <span className="bx-takip-bilgi">
              {hud.pozHz} Hz · {hud.gecikmeMs} ms{hud.yol === "ana" ? " ⚠" : ""}
              {hud.kapsam === "tam" ? " · tam kadraj" : hud.kapsam === "ust" ? " · üst gövde" : ""}
            </span>
          </div>

          {hud.kalibre && hud.faz === "round" && (
            <div className="bx-kalibre">Vuruş yoğunluğu kalibre ediliyor…</div>
          )}

          {uyari && <div className={"bx-uyari bx-uyari-" + uyari.tip}>💡 {uyari.metin}</div>}

          {hud.faz === "isinma" && !sonuc && (
            <div className="bx-katman bx-isinma">
              <div className="bx-isinma-kart">
                <h3>ISINMA</h3>
                <div className="bx-isinma-sayi">{hud.fazSure}</div>
                <p>Omuzları çevir, hafif jab-cross at, nefesini aç. Gard yukarıda, dizler yumuşak.</p>
              </div>
            </div>
          )}

          {/* ---- mola: round analizi ---- */}
          {hud.faz === "mola" && molaRapor && !sonuc && (
            <div className="bx-katman bx-mola">
              <div className="bx-mola-kart">
                <div className="bx-mola-ust">
                  <h3>Round {molaRapor.no} · Antrenör Notu</h3>
                  <span className="bx-mola-sure">{hud.fazSure} sn</span>
                </div>
                <p className="bx-mola-ozet">{molaRapor.rapor.ozet}</p>
                <div className="bx-mola-ipucu">🎯 {molaRapor.rapor.ipucu}</div>
                {molaRapor.rapor.guclu.length > 0 && (
                  <p className="bx-mola-guclu">✅ Güçlü: {molaRapor.rapor.guclu.join(", ")}</p>
                )}
              </div>
            </div>
          )}

          {/* ---- sonuç ---- */}
          {sonuc && (
            <div className="bx-katman bx-sonuc">
              <div className="bx-sonuc-kart">
                <h2>Antrenman Bitti 🔔</h2>
                <div className="bx-sonuc-puan">{sonuc.toplam.puan}</div>
                <div className="bx-sonuc-satir">
                  <span><b>{sonuc.toplam.toplamYumruk}</b> yumruk</span>
                  <span><b>{Math.round((sonuc.toplam.isabet / Math.max(1, sonuc.toplam.toplamYumruk)) * 100)}%</b> isabet</span>
                  <span><b>{sonuc.toplam.enIyiCombo}</b> en iyi seri</span>
                  <span>
                    <b>{sonuc.kalori.deger}</b> kcal{sonuc.kalori.tahmini ? "*" : ""}
                  </span>
                </div>
                {sonuc.kalori.tahmini && (
                  <p className="bx-not">* Kilo girmediğin için kalori ortalama değerle tahmin edildi.</p>
                )}
                {sonuc.rapor.oneri && (
                  <div className="bx-oneri">📏 {sonuc.rapor.oneri.metin}</div>
                )}
                {sonuc.yeniRozetler?.length > 0 && (
                  <div className="bx-rozet-serit">🏅 Yeni rozet: {sonuc.yeniRozetler.join(", ")}</div>
                )}
                <div className="bx-kayit-durum">
                  {kayit === "kaydediliyor" && "Kaydediliyor…"}
                  {kayit === "kaydedildi" && "✅ Kaydedildi"}
                  {kayit === "kuyrukta" && "☁️ Çevrimdışı kaydedildi, internet gelince gönderilecek"}
                  {kayit === "hata" && "⚠️ Kaydedilemedi"}
                </div>
                {klipVar && (
                  <button
                    className="bx-btn bx-btn-ikincil bx-genis"
                    onClick={async () => {
                      const r = await klipRef.current.paylas();
                      if (!r.ok && !r.iptal) setKayit("hata");
                    }}
                  >
                    🎬 En İyi Serinin Klibini Paylaş
                  </button>
                )}
                <div className="bx-sonuc-btnler">
                  <button
                    className="bx-btn bx-btn-ana"
                    onClick={() => {
                      temizle();
                      git("/boks/antrenor");
                    }}
                  >
                    🧠 Antrenör Raporu
                  </button>
                  <button className="bx-btn bx-btn-ikincil" onClick={tekrar}>🔄 Tekrar</button>
                  <button className="bx-btn bx-btn-ikincil" onClick={cik}>🏠 Menü</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
