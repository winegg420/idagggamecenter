// ============================================================
// MEYVE KES — oyun ekranı
// Kamera + MediaPipe el takibi + canvas render döngüsü + HUD + sonuç.
// Kamera/model getUserMedia jesti gerektirdiği için "Başla" butonuyla
// başlatılır (aynı zamanda tam ekran + wake lock alınır).
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { ElTakip } from "../../engine/eltakip.js";
import { YuzTakip } from "../../engine/yuztakip.js";
import { Oyun } from "../../engine/oyun.js";
import { manifestYukle } from "../../engine/meyveler.js";
import { ciz, koordinatHesap } from "../../engine/render.js";
import { sesBaslat, sesCal, sesAcKapa, sesDurdur } from "../../engine/ses.js";

export default function OyunPage() {
  const { mod } = useParams();
  const git = useNavigate();
  const yeme = mod === "yeme"; // MEYVE YE: el yerine ağızla oynanır
  const modAd = yeme ? "Meyve Ye" : mod === "arkadas" ? "Arkadaşla" : "Tekli";

  const canvasRef = useRef(null);
  const takipRef = useRef(null);
  const oyunRef = useRef(null);
  const rafRef = useRef(0);
  const sonZamanRef = useRef(0);
  const wakeRef = useRef(null);
  const bittiRef = useRef(false);
  const ctxRef = useRef(null);
  const kaliteRef = useRef(1);
  const fpsRef = useRef({ ema: 16, olcum: 0 });
  // Teşhis: algılama (çıkarım) frekansı — düşükse hızlı savurmalar ıskalanır.
  const algilamaRef = useRef({ damga: -1, t: 0, fps: 0 });

  const [durum, setDurum] = useState("hazir"); // hazir | baslatiliyor | oynaniyor | hata
  const [hata, setHata] = useState("");
  const [sesAcik, setSesAcik] = useState(true);
  const [hud, setHud] = useState({
    faz: "geri", geri: 3, sure: 60, puan: 0, combo: 0, sol: 0, sag: 0, el: 0,
    agizVar: false, agizAcik: false, afps: 0, yol: "",
  });
  const [sonuc, setSonuc] = useState(null); // { puan, kesim, sol, sag }
  const [kayitDurum, setKayitDurum] = useState(""); // '', 'kaydediliyor', 'kaydedildi', 'hata'
  const hudRef = useRef(0);

  // -------- skoru kaydet --------
  const skorKaydet = useCallback(
    async (puan, kesim) => {
      setKayitDurum("kaydediliyor");
      try {
        const { error } = await supabase.rpc("meyvekes_skor_kaydet", {
          p_mod: mod === "arkadas" || mod === "yeme" ? mod : "tekli",
          p_skor: puan,
          p_kesim: kesim,
        });
        if (error) throw error;
        setKayitDurum("kaydedildi");
      } catch (e) {
        console.error("Meyve Kes skor kaydı hatası:", e);
        setKayitDurum("hata");
      }
    },
    [mod]
  );

  // -------- ana döngü --------
  const dongu = useCallback(() => {
    const canvas = canvasRef.current;
    const takip = takipRef.current;
    const oyun = oyunRef.current;
    if (!canvas || !takip || !oyun) return;

    const simdi = performance.now();
    let dt = (simdi - sonZamanRef.current) / 1000;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    sonZamanRef.current = simdi;

    // adaptif çözünürlük: FPS düşükse kaliteyi kademeli düşür (netlik ↓, akıcılık ↑)
    // Ölçüm penceresi 2 sn → 1 sn: kasma başladığında tepki iki kat hızlı.
    const ft = fpsRef.current;
    ft.ema = ft.ema * 0.9 + Math.min(dt * 1000, 100) * 0.1;
    ft.olcum += dt;
    if (ft.olcum > 1) {
      ft.olcum = 0;
      if (ft.ema > 24 && kaliteRef.current > 0.5) kaliteRef.current = Math.max(0.5, kaliteRef.current - 0.15);
      else if (ft.ema < 18.5 && kaliteRef.current < 1) kaliteRef.current = Math.min(1, kaliteRef.current + 0.1);
    }

    // algılama frekansı ölçümü (saniyede kaç çıkarım sonucu geldi)
    const ar = algilamaRef.current;
    if (simdi - ar.t > 1000) {
      if (ar.damga >= 0) ar.fps = Math.round(((takip.damga - ar.damga) * 1000) / (simdi - ar.t));
      ar.damga = takip.damga;
      ar.t = simdi;
    }

    // boyut senkronu (viewport'u doldur) — dpr tavanı + piksel bütçesi
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    let olcek = Math.min(window.devicePixelRatio || 1, 1.5) * kaliteRef.current;
    const butce = 1100000; // ~1.1M piksel tavanı (büyük ekran/tabletlerde ısınma kontrolü)
    if (W * H * olcek * olcek > butce) olcek = Math.sqrt(butce / (W * H));
    const bw = Math.max(1, Math.round(W * olcek));
    const bh = Math.max(1, Math.round(H * olcek));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    let ctx = ctxRef.current;
    if (!ctx) {
      // desynchronized: tarayıcı çizimi kompozitörle senkron beklemeden gönderir
      // (kamera üstü canvas'ta gözle görülür gecikme/kasma azalması).
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      ctxRef.current = ctx;
    }
    const sc = bw / W; // mantıksal (CSS px) → tampon ölçeği
    ctx.setTransform(sc, 0, 0, sc, 0, 0);

    const k = koordinatHesap(takip.video, W, H);
    oyun.guncelle(
      dt,
      takip.eller || [],
      takip.damga,
      k.esle,
      W,
      H,
      takip.gecikmeSn,
      takip.agiz || null
    );
    ciz(ctx, oyun, takip.video, k, W, H, kaliteRef.current);

    // ses olayları (motor DOM'a dokunmaz; kuyruğu burada tüketiriz)
    // Tek karede 4 meyve birden kesilince 4 ayrı efekt çalmak hem ses patlaması
    // hem gereksiz WebAudio düğümü demek → aynı türden en fazla 2 çal.
    if (oyun.sesler.length) {
      const sayac = {};
      for (const s of oyun.sesler) {
        sayac[s] = (sayac[s] || 0) + 1;
        if (sayac[s] <= 2) sesCal(s);
      }
      if (oyun.sesler.some((s) => s !== "combo")) {
        try {
          navigator.vibrate?.(12);
        } catch {
          /* titreşim desteklenmiyor */
        }
      }
      oyun.sesler.length = 0;
    }

    // HUD'u en fazla ~7 fps ile ve YALNIZ değer değiştiyse güncelle: her karede
    // yeni state objesi göndermek React ağacını boşuna yeniden çizdiriyordu.
    if (simdi - hudRef.current > 140) {
      hudRef.current = simdi;
      const y = {
        faz: oyun.faz,
        geri: Math.ceil(oyun.geriSayim),
        sure: Math.ceil(oyun.sure),
        puan: oyun.puan,
        combo: oyun.combo,
        sol: oyun.puanSol,
        sag: oyun.puanSag,
        el: takip.elSayisi || 0,
        agizVar: !!oyun.agiz,
        agizAcik: !!oyun.agiz?.acik,
        afps: ar.fps,
        yol: takip.yol || "",
      };
      setHud((e) => {
        for (const anahtar in y) if (e[anahtar] !== y[anahtar]) return y;
        return e;
      });
    }

    // maç bitti → sonuç + kayıt (bir kez)
    if (oyun.bitti && !bittiRef.current) {
      bittiRef.current = true;
      const s = { puan: oyun.puan, kesim: oyun.kesimSayisi, sol: oyun.puanSol, sag: oyun.puanSag };
      setSonuc(s);
      skorKaydet(s.puan, s.kesim);
    }

    rafRef.current = requestAnimationFrame(dongu);
  }, [skorKaydet]);

  // -------- başlat --------
  const baslat = useCallback(async () => {
    setDurum("baslatiliyor");
    setHata("");
    try {
      // tam ekran (destekleyen tarayıcılarda) — sessizce başarısız olabilir
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch {
        /* iOS Safari desteklemeyebilir */
      }
      // wake lock (ekran uyumasın)
      try {
        if ("wakeLock" in navigator) wakeRef.current = await navigator.wakeLock.request("screen");
      } catch {
        /* yut */
      }

      manifestYukle().catch(() => {});
      // ses motoru kullanıcı jestiyle açılmalı (autoplay politikası)
      sesBaslat();
      sesAcKapa(sesAcik);

      // Meyve Ye: yüz/ağız takibi; diğer modlar: el takibi
      let takip;
      if (yeme) {
        takip = new YuzTakip();
        await takip.baslat();
      } else {
        takip = new ElTakip();
        await takip.baslat(mod === "arkadas" ? 4 : 2);
      }
      takipRef.current = takip;
      oyunRef.current = new Oyun(mod);
      bittiRef.current = false;
      setSonuc(null);
      setKayitDurum("");
      sonZamanRef.current = performance.now();
      setDurum("oynaniyor");
      rafRef.current = requestAnimationFrame(dongu);
    } catch (e) {
      console.error("Meyve Kes başlatma hatası:", e);
      setHata(e?.message || "Oyun başlatılamadı.");
      setDurum("hata");
      takipRef.current?.durdur();
      takipRef.current = null;
    }
  }, [mod, yeme, sesAcik, dongu]);

  // tekrar oyna
  const tekrar = useCallback(() => {
    oyunRef.current = new Oyun(mod);
    bittiRef.current = false;
    setSonuc(null);
    setKayitDurum("");
    sonZamanRef.current = performance.now();
  }, [mod]);

  // temizlik
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      takipRef.current?.durdur();
      takipRef.current = null;
      sesDurdur();
      try {
        wakeRef.current?.release?.();
      } catch {
        /* yut */
      }
      wakeRef.current = null;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // sekme geri gelince wake lock'ı yenile
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
    cancelAnimationFrame(rafRef.current);
    takipRef.current?.durdur();
    takipRef.current = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    git("/meyvekes");
  };

  return (
    <div className="mk-oyun-root">
      <canvas ref={canvasRef} className="mk-canvas" />

      {/* ---- Başlangıç ekranı ---- */}
      {durum === "hazir" && (
        <div className="mk-katman mk-hazir">
          <button className="mk-x" onClick={() => git("/meyvekes")}>✕</button>
          <div className="mk-hazir-kart">
            <span className="mk-logo-emoji">{yeme ? "😋" : "🍉"}</span>
            <h2>{modAd} Mod</h2>
            {yeme ? (
              <p>Kamera açılacak, telefonu tek elinle tut. Meyveler ağzına doğru gelecek — <b>tam zamanında ağzını aç ve yut!</b></p>
            ) : (
              <p>Kamera açılacak ve kendini ekranda göreceksin. Ellerini havada sallayarak meyveleri kes!</p>
            )}
            {yeme && <p className="mk-ipucu">😮 Ağzın açıkken çevresinde yeşil halka görünür — meyveyi o halkaya sok.</p>}
            {mod === "arkadas" && <p className="mk-ipucu">👥 İki kişi aynı ekranda oynayabilir — sol/sağ skorlar ayrı sayılır.</p>}
            <button className="mk-baslat-btn" onClick={baslat}>📷 Kamerayı Aç ve Başla</button>
          </div>
        </div>
      )}

      {durum === "baslatiliyor" && (
        <div className="mk-katman mk-yukleniyor">
          <div className="mk-spinner" />
          <p>Kamera ve el takibi hazırlanıyor…</p>
        </div>
      )}

      {durum === "hata" && (
        <div className="mk-katman mk-hata">
          <span className="mk-hata-emoji">📷</span>
          <p>{hata}</p>
          <div className="mk-hata-btnler">
            <button className="mk-baslat-btn" onClick={baslat}>Tekrar Dene</button>
            <button className="mk-ikincil-btn" onClick={() => git("/meyvekes")}>Geri Dön</button>
          </div>
        </div>
      )}

      {/* ---- Oyun HUD ---- */}
      {durum === "oynaniyor" && (
        <>
          <button className="mk-x" onClick={cik}>✕</button>
          <button
            className="mk-ses"
            onClick={() => setSesAcik(sesAcKapa(!sesAcik))}
            aria-label={sesAcik ? "Sesi kapat" : "Sesi aç"}
          >
            {sesAcik ? "🔊" : "🔇"}
          </button>
          <div className="mk-hud-ust">
            <div className="mk-sure">⏱️ {hud.sure}</div>
            {mod === "arkadas" ? (
              <div className="mk-skor-ikili">
                <span className="mk-skor-sol">👈 {hud.sol}</span>
                <span className="mk-skor-toplam">🍉 {hud.puan}</span>
                <span className="mk-skor-sag">{hud.sag} 👉</span>
              </div>
            ) : (
              <div className="mk-skor">🍉 {hud.puan}</div>
            )}
          </div>
          {hud.combo >= 3 && hud.faz === "oyun" && <div className="mk-combo">🔥 COMBO x{hud.combo}</div>}

          {/* takip teşhisi: kamera açık ama el/yüz görülmüyorsa uyarır */}
          {hud.faz === "oyun" && !yeme && (
            <div className={"mk-el-durum " + (hud.el > 0 ? "mk-el-var" : "mk-el-yok")}>
              {hud.el > 0 ? `🖐 ${hud.el}` : "🖐 el görünmüyor"}
              <span className="mk-takip-bilgi">
                {hud.afps} Hz{hud.yol === "ana" ? " ⚠" : ""}
              </span>
            </div>
          )}
          {hud.faz === "oyun" && yeme && (
            <div className={"mk-el-durum " + (hud.agizVar ? "mk-el-var" : "mk-el-yok")}>
              {hud.agizVar ? (hud.agizAcik ? "😋 ağız açık" : "🙂 hazır") : "😐 yüz görünmüyor"}
              <span className="mk-takip-bilgi">
                {hud.afps} Hz{hud.yol === "ana" ? " ⚠" : ""}
              </span>
            </div>
          )}

          {hud.faz === "geri" && (
            <div className="mk-katman mk-gerisayim">
              <div className="mk-gerisayim-sayi">{hud.geri > 0 ? hud.geri : "BAŞLA!"}</div>
            </div>
          )}

          {/* ---- Sonuç ---- */}
          {sonuc && (
            <div className="mk-katman mk-sonuc">
              <div className="mk-sonuc-kart">
                <h2>Süre Doldu! 🎉</h2>
                <div className="mk-sonuc-puan">{sonuc.puan}</div>
                <p className="mk-sonuc-alt">{sonuc.kesim} meyve {yeme ? "yutuldu" : "kesildi"}</p>
                {mod === "arkadas" && (
                  <p className="mk-sonuc-ikili">👈 {sonuc.sol} &nbsp;•&nbsp; {sonuc.sag} 👉</p>
                )}
                <div className="mk-kayit-durum">
                  {kayitDurum === "kaydediliyor" && "Skor kaydediliyor…"}
                  {kayitDurum === "kaydedildi" && "✅ Skor kaydedildi"}
                  {kayitDurum === "hata" && "⚠️ Skor kaydedilemedi"}
                </div>
                <div className="mk-sonuc-btnler">
                  <button className="mk-baslat-btn" onClick={tekrar}>🔄 Tekrar Oyna</button>
                  <button className="mk-ikincil-btn" onClick={() => git("/meyvekes/siralama")}>🏆 Sıralama</button>
                  <button className="mk-ikincil-btn" onClick={cik}>🏠 Menü</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
