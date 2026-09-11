// ============================================================
// MEYDAN (The Square) — SAYFA
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
import { esyaBilgisi } from "./esyalar.js";
import "./harita.css";

const EMOJILER = ["👋", "😂", "🔥", "🤔", "🎉", "⚔️"];
const MAKS_CIZILEN = 40;   // aynı anda çizilen uzak oyuncu sayısı
const YURUME_HIZI = 9;
const BILGI_ANAHTARI = "bildim_harita_bilgi";
const PERDE_SURESI = 8000;   // ilk kare bu sürede gelmezse perde kalkar, hata çıkar
// Kupa binası turnuvadan bu kadar önce açılır (sunucudaki meydan_kapi_dakika
// ile aynı olmalı; ayar değişirse buradaki yalnız kapının ERKEN görünmesini
// etkiler, ödülü sunucu kararlaştırır).
const KAPI_MS = 10 * 60 * 1000;

/** Geri sayımı levhaya yazılacak kısa metne çevirir. */
function turnuvaMetni(kalanSn) {
  if (kalanSn <= 0) return "TURNUVA BAŞLADI";
  const dk = Math.floor(kalanSn / 60);
  const sn = kalanSn % 60;
  return `TURNUVA ${dk}:${String(sn).padStart(2, "0")}`;
}

// ---- uzak oyuncu ara değerlemesi ----
// Paketler ağdan DÜZGÜN ARALIKLARLA gelmez: 100 ms'de bir gönderilse de
// 40 ms'de ikisi birden, sonra 300 ms hiç gelmez. Paket doğrudan hedefe
// yazılıp kare başına lerp edilince avatar duraklayıp sıçrıyordu
// ("ışınlanıyor, internet kopuyor gibi" — iki kişiyle bile).
//
// Çözüm klasik "entity interpolation": paketler GÖNDERENİN zaman damgasıyla
// tamponlanır ve uzak oyuncu biraz GEÇMİŞTE çizilir. O anın iki yanında
// gerçek paket bulunduğu için aradaki hareket düz bir çizgide üretilir.
//
// Ölçüm (12 tur, 20 sn, .tmp/ara-degerleme-testi3.mjs) — hız sapması:
//   iyi ağ   3.27 → 0.05      kötü ağ 7.53 → 0.43
//   duraklama %8.09 → %0.07   en büyük hız 40.3 → 13.5 (gerçek hız 9.0)
const TAMPON_MAKS = 24;
const OFSET_ORNEK = 60;      // saat farkı kestirimi için son N paket
const GECIKME_EN_AZ = 140;
const GECIKME_EN_COK = 420;
const TAHMIN_EN_COK_MS = 300; // tampon kuruyunca en fazla bu kadar ileri say
const ADIM_KATI = 1.8;        // bir karede en fazla yürüme hızının bu katı

/** İki açı arasındaki en kısa yaylı fark (ara değerleme için). */
function aciFark(hedef, aci) {
  return ((hedef - aci + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/**
 * Uzak oyuncunun saatiyle bizimki arasındaki farkı kestirir ve o oyuncu için
 * gereken ara değerleme gecikmesini verir.
 *
 * Ofset = gözlenen en küçük (varış - gönderim): en az gecikmeli paket, saat
 * farkının en temiz ölçümüdür. Gecikme = gözlenen jitter yayılımı kadar;
 * iyi ağda küçük (daha az gecikme), kötü ağda büyük (daha az sıçrama).
 */
function ofsetVeGecikme(ornekler) {
  let enAz = Infinity, enCok = -Infinity;
  for (const o of ornekler) { if (o < enAz) enAz = o; if (o > enCok) enCok = o; }
  const gecikme = ornekler.length > 8
    ? Math.min(GECIKME_EN_COK, Math.max(GECIKME_EN_AZ, (enCok - enAz) * 1.15 + 60))
    : GECIKME_EN_AZ;
  return { ofset: enAz, gecikme };
}

/** Cihaz 3B çizebiliyor mu? Yoksa siyah ekran yerine dürüst mesaj veririz. */
function webglVarMi() {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

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
  const [hata, setHata] = useState(null);   // { mesaj, tekrar:boolean }
  const [kurulum, setKurulum] = useState(0); // "Tekrar dene" sahneyi yeniden kurar
  // Kendi görünümüm + eşya kataloğu. Sahne bunlar gelmeden kurulmaz ki
  // avatar önce çıplak çizilip sonra giyinmesin.
  const [gorunumVerisi, setGorunumVerisi] = useState(null); // { gorunum, bilgi }
  // Kupa binasının kapısı: turnuvaya kalan süre (sn) — null ise kapı kapalı.
  const [turnuvaKalan, setTurnuvaKalan] = useState(null);
  const turnuvaKalanRef = useRef(null);
  turnuvaKalanRef.current = turnuvaKalan;
  const [bilgiAcik, setBilgiAcik] = useState(() => {
    try { return localStorage.getItem(BILGI_ANAHTARI) !== "1"; } catch { return true; }
  });

  // Alt sekme çubuğu, davet bandı ve toast gizlensin (soru ekranıyla aynı mod)
  useOyunModu(true);
  useEffect(() => {
    document.body.classList.add("bd-harita-acik");
    return () => document.body.classList.remove("bd-harita-acik");
  }, []);

  // Katalog + kendi görünümüm. Migration uygulanmadıysa boş görünümle
  // devam edilir (eski davranış: düz gövde + basit saç).
  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("esya_katalogum");
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        if (!aktif) return;
        setGorunumVerisi({
          gorunum: r?.gorunum && typeof r.gorunum === "object" ? r.gorunum : {},
          bilgi: esyaBilgisi(Array.isArray(r?.esyalar) ? r.esyalar : []),
        });
      } catch (e) {
        console.error("[Meydan] gorunum alinamadi:", e);
        if (aktif) setGorunumVerisi({ gorunum: {}, bilgi: {} });
      }
    })();
    return () => { aktif = false; };
  }, []);

  // Kupa binası turnuvadan KAPI_DK dakika önce açılır. Saati sunucudan
  // okuyoruz; istemci saatine güvenilmez (cihaz saati yanlış olabilir).
  useEffect(() => {
    let aktif = true;
    const bak = async () => {
      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select("id, baslangic, durum")
          .in("durum", ["lobi", "aktif"])
          .order("baslangic", { ascending: true })
          .limit(1);
        if (error) throw error;
        const t = (data ?? [])[0];
        if (!aktif) return;
        if (!t) { setTurnuvaKalan(null); return; }
        if (t.durum === "aktif") { setTurnuvaKalan(0); return; }
        const kalanMs = new Date(t.baslangic).getTime() - Date.now();
        setTurnuvaKalan(kalanMs <= KAPI_MS ? Math.max(0, Math.round(kalanMs / 1000)) : null);
      } catch (e) {
        console.error("[Meydan] turnuva durumu alinamadi:", e);
      }
    };
    bak();
    const id = setInterval(bak, 20000);
    return () => { aktif = false; clearInterval(id); };
  }, []);

  // Kapı açıkken geri sayım saniyede bir iner (sunucuya tekrar gitmeden).
  useEffect(() => {
    if (turnuvaKalan === null || turnuvaKalan <= 0) return undefined;
    const id = setInterval(() => setTurnuvaKalan((k) => (k === null ? null : Math.max(0, k - 1))), 1000);
    return () => clearInterval(id);
  }, [turnuvaKalan === null, turnuvaKalan === 0]);

  const ad = profile?.gorunen_ad || "Oyuncu";
  // Ad, sahnenin KURULUM koşulu değil; yalnız avatarın etiketi.
  // Effect bağımlılığına girerse profil bir an boşalınca (oturum tazeleme,
  // profilim RPC'sinin başarısız dönmesi) sahne yıkılıyor ve bir daha
  // kurulmuyordu — siyah ekranın sebebi buydu. Artık ref'ten okunuyor.
  const adRef = useRef(ad);
  adRef.current = ad;

  useEffect(() => {
    const kapsayici = kapsayiciRef.current;
    if (!kapsayici || !user || !gorunumVerisi) return undefined;

    if (!webglVarMi()) {
      setYukleniyor(false);
      setHata({ mesaj: "Cihazın 3B grafik desteklemiyor.", tekrar: false });
      return undefined;
    }

    let dunya = null, kontrol = null, coklu = null;
    let raf = 0, aktif = true;
    const uzaklar = new Map(); // id -> { av, tampon:[{t,x,z,y}], yerlesti }
    // Presence bir an titrerse (kanal düşüp kalkması) oyuncu ayrılıp yeniden
    // katılmış sayılıyor ve avatarı meydanın rastgele bir kenarında doğuyordu.
    // Son bilinen konum saklanıp geri dönüşte oraya konuyor.
    const sonKonum = new Map(); // id -> {x, z, y}
    let ipucuSon = null;
    let sonSiralama = 0;

    try {
      const dusukDonanim = (navigator.hardwareConcurrency || 8) <= 4;
      const hareketAzalt = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      dunya = dunyaKur(kapsayici, { dusukDonanim, hareketAzalt });
    } catch (e) {
      console.error("[Meydan] sahne kurulamadi:", e);
      setYukleniyor(false);
      setHata({ mesaj: "Sahne kurulamadı.", tekrar: true });
      return undefined;
    }

    const renk = renkUret(user.id);
    // Profil henüz gelmediyse avatar geçici "Oyuncu" adıyla kurulur;
    // ad gelince aşağıdaki effect yalnız etiketi yeniler.
    const ben = dunya.avatarOlustur(
      adRef.current, renk.govde, renk.sac, renk.etiket,
      gorunumVerisi.gorunum, gorunumVerisi.bilgi
    );
    ben.position.set(0, 0, 11);

    kontrol = kontrolKur(padRef.current, topuzRef.current);

    coklu = meydanBaglan({
      supabase,
      ben: { id: user.id, ad: adRef.current, renk: renk.govde, sac: renk.sac,
             gorunum: gorunumVerisi.gorunum },
      onKatilim(id, bilgi) {
        if (uzaklar.has(id)) return;
        const varsayilan = renkUret(id);
        const govde = typeof bilgi?.renk === "number" ? bilgi.renk : varsayilan.govde;
        const sac = typeof bilgi?.sac === "number" ? bilgi.sac : varsayilan.sac;
        // Uzak oyuncunun görünümü presence yükünde geldi (kare kare değil).
        const av = dunya.avatarOlustur(
          String(bilgi?.ad || "Oyuncu"), govde, sac, "#" + govde.toString(16).padStart(6, "0"),
          bilgi?.gorunum ?? null, gorunumVerisi.bilgi
        );
        const eski = sonKonum.get(id);
        if (eski) {
          // Kısa bir kopmadan dönüyor: bıraktığı yerde belirsin
          av.position.set(eski.x, 0, eski.z);
          av.rotation.y = eski.y;
        } else {
          // İlk konum paketi gelene kadar ÇİZİLMEZ. Eskiden meydan kenarında
          // rastgele bir noktaya konuyor, ilk paketle oraya zıplıyordu.
          av.position.set(0, 0, 0);
          av.visible = false;
        }
        uzaklar.set(id, {
          av,
          tampon: [],            // {t,x,z,y} — t GÖNDERENİN saatinde
          ornekler: [],          // varış - gönderim farkları (saat kestirimi)
          sonHiz: { x: 0, z: 0 },
          yerlesti: Boolean(eski),
        });
      },
      onAyrilma(id) {
        const u = uzaklar.get(id);
        if (!u) return;
        if (u.yerlesti) {
          sonKonum.set(id, { x: u.av.position.x, z: u.av.position.z, y: u.av.rotation.y });
        }
        dunya.avatarSil(u.av);
        uzaklar.delete(id);
      },
      onPoz(id, p) {
        const u = uzaklar.get(id);
        if (!u) return;
        const x = Number(p.x), z = Number(p.z), donus = Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(donus)) return;
        const varis = performance.now();
        // Eski sürüm damga göndermiyor olabilir: varış zamanına düş
        const gt = Number.isFinite(Number(p.t)) ? Number(p.t) : varis;
        const son = u.tampon[u.tampon.length - 1];
        if (son && gt <= son.t) return;   // sıra bozucu / yinelenen paketi at
        u.ornekler.push(varis - gt);
        if (u.ornekler.length > OFSET_ORNEK) u.ornekler.shift();
        u.tampon.push({ t: gt, x, z, y: donus });
        if (u.tampon.length > TAMPON_MAKS) u.tampon.shift();
        // İlk paket: avatarı oraya koy ve görünür yap (kayarak gitmesin)
        if (!u.yerlesti) {
          u.yerlesti = true;
          u.av.position.set(x, 0, z);
          u.av.rotation.y = donus;
          u.av.visible = true;
        }
      },
      onGorunum(id, g) {
        // Kıyafet değişimi: SAHNE YIKILMAZ, yalnız eşyalar yenilenir.
        const u = uzaklar.get(id);
        if (!u) return;
        try { dunya.avatarGorunumu(u.av, g ?? {}, gorunumVerisi.bilgi); }
        catch (e) { console.error("[Meydan] uzak gorunum:", e); }
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

    canliRef.current = { dunya, ben, coklu, renk };

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

    // İlk kare hiç gelmezse perde sonsuza kadar kalıyordu ("sahne
    // hazırlanıyor…" takılması). Sekme gizliyken tarayıcı rAF'ı durdurduğu
    // için o durumda süre yeniden kurulur, hata gösterilmez.
    let perdeSaat = 0;
    const perdeBek = () => {
      if (!aktif || !ilkKare) return;
      if (document.hidden) { perdeSaat = setTimeout(perdeBek, 2000); return; }
      setYukleniyor(false);
      setHata({ mesaj: "Sahne yüklenemedi.", tekrar: true });
    };
    perdeSaat = setTimeout(perdeBek, PERDE_SURESI);

    const cizim = (t) => {
      if (!aktif) return;
      raf = requestAnimationFrame(cizim);
      if (document.hidden) { sonT = t; return; }   // sayfa gizliyken render yok
      try {
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

      // ---- uzak oyuncular: gönderenin saatinde biraz geçmişteki konum
      for (const u of uzaklar.values()) {
        const av = u.av;
        if (!u.yerlesti) continue;
        const tp = u.tampon;
        if (!tp.length) continue;

        const { ofset, gecikme } = ofsetVeGecikme(u.ornekler);
        const gecmis = t - ofset - gecikme;   // gönderenin saatinde an
        // Görüntüleme anını geride bırakmış paketleri at (biri elde kalsın)
        while (tp.length >= 2 && tp[1].t <= gecmis) tp.shift();

        let hx, hz, hy;
        if (tp.length >= 2 && tp[0].t <= gecmis) {
          // İki gerçek paket arasındayız: aradaki hareketi düz üret
          const a = tp[0], b = tp[1];
          const aralik = b.t - a.t || 1;
          const oran = Math.min(1, Math.max(0, (gecmis - a.t) / aralik));
          hx = a.x + (b.x - a.x) * oran;
          hz = a.z + (b.z - a.z) * oran;
          hy = a.y + aciFark(b.y, a.y) * oran;
          u.sonHiz.x = (b.x - a.x) / (aralik / 1000);
          u.sonHiz.z = (b.z - a.z) / (aralik / 1000);
        } else {
          // Tampon kurudu: son bilinen hızla kısa süre devam et. Olduğu
          // yerde donup sonra sıçramaktan çok daha az göze batıyor.
          const s = tp[tp.length - 1];
          const ileri = Math.min(TAHMIN_EN_COK_MS, Math.max(0, gecmis - s.t)) / 1000;
          hx = s.x + u.sonHiz.x * ileri;
          hz = s.z + u.sonHiz.z * ileri;
          hy = s.y;
        }

        // Hiçbir karede ışınlanma olmasın: adım yürüme hızıyla sınırlı
        const onceX = av.position.x, onceZ = av.position.z;
        const adimX = hx - onceX, adimZ = hz - onceZ;
        const adim = Math.hypot(adimX, adimZ);
        const enFazla = YURUME_HIZI * ADIM_KATI * dt;
        if (adim > enFazla && adim > 0) {
          av.position.x = onceX + (adimX / adim) * enFazla;
          av.position.z = onceZ + (adimZ / adim) * enFazla;
        } else {
          av.position.x = hx;
          av.position.z = hz;
        }
        dunya.yumusakDon(av, hy, dt, 14);
        // Yürüme animasyonunun şiddeti gerçek hızdan gelir
        const hiz = dt > 0 ? Math.hypot(av.position.x - onceX, av.position.z - onceZ) / dt : 0;
        dunya.yurumeAnimasyonu(av, dt, hiz > 0.4 ? Math.min(1, hiz / YURUME_HIZI) : 0);
      }
      // 40'tan fazla oyuncu varsa yalnız en yakın 40'ı çiz (yarım saniyede bir sırala)
      if (uzaklar.size > MAKS_CIZILEN && zaman - sonSiralama > 0.5) {
        sonSiralama = zaman;
        const sirali = [...uzaklar.values()].sort(
          (a, b) => a.av.position.distanceToSquared(ben.position) - b.av.position.distanceToSquared(ben.position)
        );
        // yerlesti: ilk konum paketi gelmemiş avatar hiç çizilmez
        sirali.forEach((u, i) => { u.av.visible = u.yerlesti && i < MAKS_CIZILEN; });
      } else if (uzaklar.size <= MAKS_CIZILEN && sonSiralama !== 0) {
        sonSiralama = 0;
        for (const u of uzaklar.values()) u.av.visible = u.yerlesti;
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
        clearTimeout(perdeSaat);
        setTimeout(() => { if (aktif) setYukleniyor(false); }, 450);
      }
      } catch (e) {
        // Tek bir kare hatası eskiden bütün sahneyi sessizce öldürüyordu ve
        // oyuncu boş ekran görüyordu. Artık durur ve sebebini söyler.
        console.error("[Meydan] kare hatasi:", e);
        aktif = false;
        cancelAnimationFrame(raf);
        clearTimeout(perdeSaat);
        setYukleniyor(false);
        setHata({ mesaj: "Sahne çizilemedi.", tekrar: true });
      }
    };
    raf = requestAnimationFrame(cizim);

    return () => {
      aktif = false;
      cancelAnimationFrame(raf);
      clearTimeout(perdeSaat);
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
    // Sahne oturum sahibi başına BİR KEZ kurulur. `profile` bilerek yok:
    // profil bir an boşalınca sahnenin yıkılmasını istemiyoruz.
    // `kurulum` yalnız "Tekrar dene" düğmesiyle artar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, kurulum, gorunumVerisi]);

  // Sekmeye dönünce görünümü tazele: oyuncu BAŞKA SEKMEDE kıyafet değiştirmiş
  // olabilir. Değiştiyse kendi avatarımız sahneyi yıkmadan güncellenir ve
  // meydandakilere TEK broadcast mesajı gider (kare kare değil).
  useEffect(() => {
    if (!gorunumVerisi) return undefined;
    const tazele = async () => {
      if (document.hidden) return;
      try {
        const { data, error } = await supabase.rpc("esya_katalogum");
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        const yeni = r?.gorunum && typeof r.gorunum === "object" ? r.gorunum : {};
        const c = canliRef.current;
        if (!c || JSON.stringify(yeni) === JSON.stringify(gorunumVerisi.gorunum)) return;
        gorunumVerisi.gorunum = yeni;   // sahneyi yeniden kurmadan güncelle
        c.dunya.avatarGorunumu(c.ben, yeni, gorunumVerisi.bilgi);
        c.coklu.gorunumGonder(yeni);
      } catch (e) {
        console.error("[Meydan] gorunum tazelenemedi:", e);
      }
    };
    document.addEventListener("visibilitychange", tazele);
    window.addEventListener("focus", tazele);
    return () => {
      document.removeEventListener("visibilitychange", tazele);
      window.removeEventListener("focus", tazele);
    };
  }, [gorunumVerisi]);

  // Kapı durumu sahneye yansıtılır: bina ışır, üstünde geri sayım belirir.
  useEffect(() => {
    const c = canliRef.current;
    if (!c?.dunya?.turnuvaKapisi) return;
    try {
      c.dunya.turnuvaKapisi(turnuvaKalan === null ? null : turnuvaMetni(turnuvaKalan));
    } catch (e) {
      console.error("[Meydan] turnuva kapisi:", e);
    }
  }, [turnuvaKalan, yukleniyor]);

  // Profil sonradan gelirse sahneyi yıkmadan yalnız isim etiketini yenile.
  useEffect(() => {
    const c = canliRef.current;
    if (!c) return;
    try {
      c.dunya.avatarAdiDegistir(c.ben, ad, c.renk.etiket);
    } catch (e) {
      console.error("[Meydan] ad guncellenemedi:", e);
    }
  }, [ad]);

  const tekrarDene = () => {
    setHata(null);
    setYukleniyor(true);
    setKurulum((k) => k + 1);
  };

  /**
   * Binaya giriş. Turnuva binasıysa ÖNCE sunucuya damga bastırılır:
   * ödül istemciye değil, o RPC'nin pencere kontrolüne bağlıdır.
   * Damga başarısız olsa da oyuncu lobiye girer — ödül kaybı yaşanmaz,
   * yalnız etkinlik teşviki verilmez.
   */
  const binayaGir = async (rota) => {
    if (rota === "/turnuva" && turnuvaKalanRef.current !== null) {
      try {
        await supabase.rpc("meydan_turnuva_damgasi");
      } catch (e) {
        console.error("[Meydan] turnuva damgasi basilamadi:", e);
      }
    }
    navigate(y(rota));
  };

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

      {yukleniyor && !hata && (
        <div className="bd-harita-yukleniyor">
          <div>
            <b>Meydan</b>
            <span>sahne hazırlanıyor…</span>
          </div>
        </div>
      )}

      {hata && (
        <div className="bd-harita-yukleniyor" role="alert">
          <div className="bd-harita-hata">
            <b>Meydan açılamadı</b>
            <span>{hata.mesaj}</span>
            <div className="bd-harita-hata-dugmeler">
              {hata.tekrar && (
                <button type="button" className="bd-harita-btn" onClick={tekrarDene}>
                  Tekrar dene
                </button>
              )}
              <button type="button" className="bd-harita-btn beyaz" onClick={() => navigate(y())}>
                Oyuna dön
              </button>
            </div>
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
          onClick={() => binayaGir(ipucu.rota)}
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
