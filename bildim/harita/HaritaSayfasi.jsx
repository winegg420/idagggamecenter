// ============================================================
// QUIZADOR MEYDANI — SAYFA
//
// Yalnız React yaşam döngüsü ve HUD burada. three.js sahnesi dunya.js'te,
// girdi kontrol.js'te, Realtime coklu.js'te. Bu dosya üçünü bağlar ve
// sayfadan çıkarken hepsini serbest bırakır (sızıntı bırakmadan).
//
// Lazy yüklenir: Harita'ya girmeyen oyuncu three.js indirmez.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { useOyunModu } from "../lib/oyunModu.js";
import { y } from "../lib/yol.js";
import { dunyaKur } from "./dunya.js";
import { kontrolKur } from "./kontrol.js";
import { meydanBaglan } from "./coklu.js";
import { renkUret } from "./renk.js";
import "./harita.css";

const EMOJILER = ["👋", "😂", "🔥", "🤔", "🎉", "⚔️"];
const MAKS_CIZILEN = 40;   // aynı anda çizilen uzak oyuncu sayısı
const YURUME_HIZI = 9;
const BILGI_ANAHTARI = "bildim_harita_bilgi";

export default function HaritaSayfasi() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const kapsayiciRef = useRef(null);
  const padRef = useRef(null);
  const topuzRef = useRef(null);
  const canliRef = useRef(null); // { dunya, ben, coklu }

  const [yukleniyor, setYukleniyor] = useState(true);
  const [kisi, setKisi] = useState(1);
  const [bagli, setBagli] = useState(true);
  const [ipucu, setIpucu] = useState(null); // { ad, alt, rota }
  const [bilgiAcik, setBilgiAcik] = useState(() => {
    try { return localStorage.getItem(BILGI_ANAHTARI) !== "1"; } catch { return true; }
  });

  // Alt sekme çubuğu, davet bandı ve toast gizlensin (soru ekranıyla aynı mod)
  useOyunModu(true);
  useEffect(() => {
    document.body.classList.add("bd-harita-acik");
    return () => document.body.classList.remove("bd-harita-acik");
  }, []);

  const ad = profile?.gorunen_ad || "Oyuncu";

  useEffect(() => {
    const kapsayici = kapsayiciRef.current;
    if (!kapsayici || !user || !profile) return undefined;

    let dunya = null, kontrol = null, coklu = null;
    let raf = 0, aktif = true;
    const uzaklar = new Map(); // id -> { av, hedef:{x,z,y} }
    let ipucuSon = null;
    let sonSiralama = 0;

    try {
      const dusukDonanim = (navigator.hardwareConcurrency || 8) <= 4;
      const hareketAzalt = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      dunya = dunyaKur(kapsayici, { dusukDonanim, hareketAzalt });
    } catch (e) {
      console.error("[Meydan] sahne kurulamadi:", e);
      setYukleniyor(false);
      return undefined;
    }

    const renk = renkUret(user.id);
    const ben = dunya.avatarOlustur(ad, renk.govde, renk.sac, renk.etiket);
    ben.position.set(0, 0, 11);

    kontrol = kontrolKur(padRef.current, topuzRef.current);

    coklu = meydanBaglan({
      supabase,
      ben: { id: user.id, ad, renk: renk.govde, sac: renk.sac },
      onKatilim(id, bilgi) {
        if (uzaklar.has(id)) return;
        const varsayilan = renkUret(id);
        const govde = typeof bilgi?.renk === "number" ? bilgi.renk : varsayilan.govde;
        const sac = typeof bilgi?.sac === "number" ? bilgi.sac : varsayilan.sac;
        const av = dunya.avatarOlustur(
          String(bilgi?.ad || "Oyuncu"), govde, sac, "#" + govde.toString(16).padStart(6, "0")
        );
        // İlk konum paketi gelene kadar meydan kenarında dursun
        const a = Math.random() * Math.PI * 2;
        av.position.set(Math.cos(a) * 9, 0, Math.sin(a) * 9);
        uzaklar.set(id, { av, hedef: { x: av.position.x, z: av.position.z, y: 0 } });
      },
      onAyrilma(id) {
        const u = uzaklar.get(id);
        if (!u) return;
        dunya.avatarSil(u.av);
        uzaklar.delete(id);
      },
      onPoz(id, p) {
        const u = uzaklar.get(id);
        if (!u) return;
        // Doğrudan uygulanmaz; hedef olarak tutulur, karede lerp edilir
        u.hedef.x = Number(p.x) || 0;
        u.hedef.z = Number(p.z) || 0;
        u.hedef.y = Number(p.y) || 0;
      },
      onEmoji(id, e) {
        const u = uzaklar.get(id);
        if (u && e) dunya.emojiGoster(u.av, e);
      },
      onDurum(b, sayi) {
        if (!aktif) return;
        setBagli(b);
        setKisi(Math.max(1, sayi));
      },
    });

    canliRef.current = { dunya, ben, coklu };

    const boyut = () => dunya.boyutlandir();
    // Telefon yan çevrilince: orientationchange ANINDA tarayıcı hâlâ eski
    // ölçüyü bildiriyor; tek seferlik boyutlandırma sahneyi yamuk bırakıyor
    // (kullanıcı "yatayda oynanmıyor" diye bildirdi). Olaydan sonra birkaç
    // kez daha ölçüyoruz; ayrıca visualViewport varsa onu da dinliyoruz.
    const gecikmeler = [];
    const boyutTekrar = () => {
      boyut();
      for (const ms of [120, 320, 650]) gecikmeler.push(setTimeout(boyut, ms));
    };
    window.addEventListener("resize", boyut);
    window.addEventListener("orientationchange", boyutTekrar);
    window.visualViewport?.addEventListener?.("resize", boyut);

    let sonT = performance.now(), zaman = 0, ilkKare = true;
    const cizim = (t) => {
      if (!aktif) return;
      raf = requestAnimationFrame(cizim);
      if (document.hidden) { sonT = t; return; }   // sayfa gizliyken render yok
      const dt = Math.min((t - sonT) / 1000, 0.05);
      sonT = t; zaman += dt;

      // ---- kendi hareketim
      const { ix, iz } = kontrol.oku();
      const guc = Math.min(Math.hypot(ix, iz), 1);
      if (guc > 0.05) {
        const yon = Math.atan2(ix, iz);
        ben.position.x += Math.sin(yon) * guc * YURUME_HIZI * dt;
        ben.position.z += Math.cos(yon) * guc * YURUME_HIZI * dt;
        dunya.carpismaDuzelt(ben.position, 0.8);
        dunya.yumusakDon(ben, yon, dt, 12);
      }
      dunya.yurumeAnimasyonu(ben, dt, guc);
      coklu.pozGonder(ben.position.x, ben.position.z, ben.rotation.y);

      // ---- uzak oyuncular: hedefe ara değerle yaklaş
      const k = Math.min(1, dt * 10);
      for (const u of uzaklar.values()) {
        const av = u.av;
        const dx = u.hedef.x - av.position.x, dz = u.hedef.z - av.position.z;
        const uz = Math.hypot(dx, dz);
        av.position.x += dx * k;
        av.position.z += dz * k;
        dunya.yumusakDon(av, u.hedef.y, dt, 10);
        dunya.yurumeAnimasyonu(av, dt, uz > 0.08 ? Math.min(1, uz) : 0);
      }
      // 40'tan fazla oyuncu varsa yalnız en yakın 40'ı çiz (yarım saniyede bir sırala)
      if (uzaklar.size > MAKS_CIZILEN && zaman - sonSiralama > 0.5) {
        sonSiralama = zaman;
        const sirali = [...uzaklar.values()].sort(
          (a, b) => a.av.position.distanceToSquared(ben.position) - b.av.position.distanceToSquared(ben.position)
        );
        sirali.forEach((u, i) => { u.av.visible = i < MAKS_CIZILEN; });
      } else if (uzaklar.size <= MAKS_CIZILEN && sonSiralama !== 0) {
        sonSiralama = 0;
        for (const u of uzaklar.values()) u.av.visible = true;
      }

      // ---- bina ipucu (yalnız değişince state yazılır)
      const yakin = dunya.yakinBina(ben.position);
      if (yakin !== ipucuSon) {
        ipucuSon = yakin;
        setIpucu(yakin ? { ad: yakin.ad, alt: yakin.alt, rota: yakin.rota } : null);
      }

      dunya.guncelle(dt, zaman, ben);
      if (ilkKare) {
        ilkKare = false;
        setTimeout(() => { if (aktif) setYukleniyor(false); }, 450);
      }
    };
    raf = requestAnimationFrame(cizim);

    return () => {
      aktif = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", boyut);
      window.removeEventListener("orientationchange", boyutTekrar);
      window.visualViewport?.removeEventListener?.("resize", boyut);
      for (const g of gecikmeler) clearTimeout(g);
      try { coklu?.kapat(); } catch (e) { console.error("[Meydan] kapat:", e); }
      try { kontrol?.yokEt(); } catch (e) { console.error("[Meydan] kontrol:", e); }
      for (const u of uzaklar.values()) { try { dunya.avatarSil(u.av); } catch { /* yut */ } }
      uzaklar.clear();
      try { dunya?.yokEt(); } catch (e) { console.error("[Meydan] yokEt:", e); }
      canliRef.current = null;
    };
    // Sahne bir kez kurulur; ad ilk girişte etiketlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, Boolean(profile)]);

  const emojiAt = (e) => {
    const c = canliRef.current;
    if (!c) return;
    // Hız sınırı coklu'da (2 sn); geçtiyse kendi balonumuz da çıkar
    if (c.coklu.emojiGonder(e)) c.dunya.emojiGoster(c.ben, e);
  };

  const bilgiKapat = () => {
    setBilgiAcik(false);
    try { localStorage.setItem(BILGI_ANAHTARI, "1"); } catch { /* özel mod */ }
  };

  return (
    <div className="bd-harita">
      <div className="bd-harita-sahne" ref={kapsayiciRef} />

      {yukleniyor && (
        <div className="bd-harita-yukleniyor">
          <div>
            <b>Quizador Meydanı</b>
            <span>sahne hazırlanıyor…</span>
          </div>
        </div>
      )}

      <div className="bd-harita-hud bd-harita-ust">
        <button type="button" className="bd-harita-btn beyaz" onClick={() => navigate(y())}>
          ‹ Oyuna dön
        </button>
        <span className="bd-harita-hap" role="status">
          <span className={"canli" + (bagli ? "" : " kopuk")} />
          {bagli ? `${kisi} kişi burada` : "bağlantı yok"}
        </span>
      </div>

      {ipucu && (
        <button
          type="button"
          className="bd-harita-hud bd-harita-ipucu"
          onClick={() => navigate(y(ipucu.rota))}
        >
          {ipucu.ad}
          <small>{ipucu.alt} — girmek için dokun</small>
        </button>
      )}

      {bilgiAcik && (
        <div className="bd-harita-bilgi">
          <b>Meydandasın</b>
          Yürümek için sağ alttaki topuzu sürükle (veya WASD / yön tuşları). Binalara yaklaşınca kapı açılır.
          <br />
          <button type="button" className="bd-harita-btn" onClick={bilgiKapat}>Anladım</button>
        </div>
      )}

      <div className="bd-harita-hud bd-harita-alt">
        <div className="bd-harita-emojiler">
          {EMOJILER.map((e) => (
            <button key={e} type="button" className="bd-harita-emoji" onClick={() => emojiAt(e)} aria-label={`Emoji ${e}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="bd-harita-pad" ref={padRef} aria-label="Yürüme topuzu">
          <div className="bd-harita-topuz" ref={topuzRef} />
        </div>
      </div>
    </div>
  );
}
