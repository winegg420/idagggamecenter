// ============================================================
// MEYDAN (The Square) — SAYFA
//
// Yalnız React yaşam döngüsü ve HUD burada. three.js sahnesi dunya.js'te,
// girdi kontrol.js'te, Realtime coklu.js'te. Bu dosya üçünü bağlar ve
// sayfadan çıkarken hepsini serbest bırakır (sızıntı bırakmadan).
//
// Lazy yüklenir: Harita'ya girmeyen oyuncu three.js indirmez.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { useOyunModu } from "../lib/oyunModu.js";
import { hataMesaji } from "../lib/hata.js";
import { y } from "../lib/yol.js";
import { dunyaKur } from "./dunya.js";
import { kontrolKur } from "./kontrol.js";
import { meydanBaglan } from "./coklu.js";
import { renkUret } from "./renk.js";
import { esyaBilgisi } from "./esyalar.js";
import { zumKur } from "./zum.js";
import { dansVarMi } from "./danslar.js";
import { yonDurumu, yonOzeti, yatayaGec, dikeyeDon } from "./yon.js";
import { turnuvaSaatleriniAyarla } from "../lib/zaman.js";
import { donusKaydet, donusOku, donusTemizle } from "./donus.js";
import { MENU, ikramGonder, ikramYanitla, bekleyenIkramlar, IKRAM_SURE_SN, ZAMAN_ASIMI_SN } from "./etkilesim.js";
import { kahveBasla, balonBasla, ikramKaresi, ikramlariTemizle } from "./ikramGorsel.js";
import { meydanBotlariniAl, botKonumu, botJesti } from "./meydanBotlari.js";
import "./harita.css";

const EMOJILER = ["👋", "😂", "🔥", "🤔", "🎉", "⚔️"];
const MAKS_CIZILEN = 40;   // aynı anda çizilen uzak oyuncu sayısı
const YURUME_HIZI = 9;
const BILGI_ANAHTARI = "bildim_harita_bilgi";
// Kurulu uygulamada yatay uyarısı bir kez gösterilir
const YATAY_UYARI_ANAHTARI = "bildim_harita_yatay_uyari";
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
  // Dokunulan oyuncu (menü) ve gelen ikram teklifi
  const [secilenOyuncu, setSecilenOyuncu] = useState(null);
  const [gelenIkram, setGelenIkram] = useState(null);
  const [ikramNotu, setIkramNotu] = useState(null);
  const [ikramCalisiyor, setIkramCalisiyor] = useState(false);
  const bekleyenIkramRef = useRef(null);   // gönderdiğim teklif { id, tur, alan }
  const turnuvaKalanRef = useRef(null);
  turnuvaKalanRef.current = turnuvaKalan;
  // Dans tepsisi açık mı (emoji çubuğunun üstünde açılır)
  const [dansAcik, setDansAcik] = useState(false);
  // Ekran yönü: teşhis satırı, yatay kilit durumu ve uyarı
  const [yon, setYon] = useState(() => yonDurumu());
  const [yatayKilitli, setYatayKilitli] = useState(false);
  const [yonUyari, setYonUyari] = useState(null);
  // Kurulu uygulamada manifest kilidi anlatılsın (bir kez)
  const [yatayBilgi, setYatayBilgi] = useState(false);
  const [bilgiAcik, setBilgiAcik] = useState(() => {
    try { return localStorage.getItem(BILGI_ANAHTARI) !== "1"; } catch { return true; }
  });

  // ---- EKRAN YÖNÜ TEŞHİSİ ----
  // Sahibi telefonunda konsola bakıp ekran görüntüsü gönderebilsin diye
  // durum hem konsola yazılır hem HUD'da küçük gri bir satırda görünür.
  useEffect(() => {
    const d = yonDurumu();
    setYon(d);
    console.log("[Meydan] yon", {
      ekran: d.ekran, aci: d.aci, kurulu: d.kurulu,
      tamEkran: d.tamEkran, pencere: d.pencere,
    });
    // KURULU uygulamada ve ekran DİKEYKEN bir kez açıklama göster:
    // manifest kilidi kurulum anında okunduğu için kısayol yenilenmeli.
    try {
      const gosterildi = localStorage.getItem(YATAY_UYARI_ANAHTARI) === "1";
      const dikey = !d.ekran || String(d.ekran).startsWith("portrait");
      if (d.kurulu && dikey && !gosterildi) setYatayBilgi(true);
    } catch { /* özel mod */ }

    const tazele = () => setYon(yonDurumu());
    window.addEventListener("orientationchange", tazele);
    window.addEventListener("resize", tazele);
    document.addEventListener("fullscreenchange", tazele);
    return () => {
      window.removeEventListener("orientationchange", tazele);
      window.removeEventListener("resize", tazele);
      document.removeEventListener("fullscreenchange", tazele);
    };
  }, []);

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
        const katalog = Array.isArray(r?.esyalar) ? r.esyalar : [];
        const sahip = new Set(Array.isArray(r?.sahip) ? r.sahip : []);
        setGorunumVerisi({
          gorunum: r?.gorunum && typeof r.gorunum === "object" ? r.gorunum : {},
          bilgi: esyaBilgisi(katalog),
          // Danslar giyilmez: yalnız SAHİP OLUNANLAR meydanda oynatılabilir.
          // Oynatıcısı olmayan kod (katalogda var, kodda yok) listelenmez.
          danslar: katalog
            .filter((e) => e.yuva === "dans" && sahip.has(e.kod) && dansVarMi(e.kod))
            .map((e) => ({ kod: e.kod, ad: e.ad })),
        });
      } catch (e) {
        console.error("[Meydan] gorunum alinamadi:", e);
        if (aktif) setGorunumVerisi({ gorunum: {}, bilgi: {}, danslar: [] });
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
        // Aktif turnuva varsa kapı hemen açık.
        const { data: aktifler, error: aHata } = await supabase
          .from("tournaments")
          .select("id")
          .eq("durum", "aktif")
          .limit(1);
        if (aHata) throw aHata;
        if (!aktif) return;
        if ((aktifler ?? []).length > 0) { setTurnuvaKalan(0); return; }

        // Sıradaki turnuvanın TAM ANI sunucudan gelir (saatler
        // oyun_ayarlari'nda; lobi satırında `baslangic` henüz boş olduğu
        // için oradan okumak yanlış sonuç veriyordu).
        const { data, error } = await supabase.rpc("sonraki_turnuva_ani");
        if (error) throw error;
        const t = Array.isArray(data) ? data[0] : data;
        if (!aktif) return;
        if (!t?.baslangic) { setTurnuvaKalan(null); return; }
        turnuvaSaatleriniAyarla(t.saat_sabah, t.saat_aksam);
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

  // Broadcast paketi kaybolabilir: bekleyen teklifler ayrıca yoklanır.
  // (Sunucu 20 sn sonra zaten iptal edip coini iade ediyor.)
  useEffect(() => {
    let aktif = true;
    const bak = async () => {
      if (document.hidden) return;
      try {
        const liste = await bekleyenIkramlar();
        if (!aktif || liste.length === 0) return;
        const t = liste[0];
        setGelenIkram((o) => o ?? {
          id: t.id, tur: t.tur, gonderenId: t.gonderen, gonderenAd: t.gonderen_ad,
        });
      } catch (e) {
        console.error("[Meydan] bekleyen ikramlar:", e);
      }
    };
    bak();
    const id = setInterval(bak, 6000);
    return () => { aktif = false; clearInterval(id); };
  }, []);

  // Sahip olunan danslar (dans tepsisi bunları listeler)
  const danslar = gorunumVerisi?.danslar ?? [];

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
    // Nöbetteki meydan botları: id -> { av, tohum, sonJest }
    const botlar = new Map();
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
      setHata({ mesaj: "Sahne kurulamadı.", ayrinti: String(e?.message ?? e), tekrar: true });
      return undefined;
    }

    const renk = renkUret(user.id);
    // Profil henüz gelmediyse avatar geçici "Oyuncu" adıyla kurulur;
    // ad gelince aşağıdaki effect yalnız etiketi yeniler.
    // Try İÇİNDE: eşya üreticilerinden biri patlarsa sahne kurulumu gibi
    // ele alınsın, React ağacını komple düşürmesin.
    let ben;
    try {
      ben = dunya.avatarOlustur(
        adRef.current, renk.govde, renk.sac, renk.etiket,
        gorunumVerisi.gorunum, gorunumVerisi.bilgi
      );
    } catch (e) {
      console.error("[Meydan] avatar kurulamadi:", e);
      try { dunya.yokEt(); } catch { /* yut */ }
      setYukleniyor(false);
      setHata({ mesaj: "Avatarın çizilemedi.", ayrinti: String(e?.message ?? e), tekrar: true });
      return undefined;
    }
    // Meydandan bir maça girip dönen oyuncu AYRILDIĞI noktada doğar.
    // Kayıt burada TÜKETİLİR: bir sonraki çıkışta yenisi yazılır.
    const donus = donusOku();
    if (donus) {
      ben.position.set(donus.x, 0, donus.z);
      ben.rotation.y = donus.aci ?? 0;
      donusTemizle();
    } else {
      ben.position.set(0, 0, 11);
    }

    kontrol = kontrolKur(padRef.current, topuzRef.current);

    coklu = meydanBaglan({
      supabase,
      ben: { id: user.id, ad: adRef.current, renk: renk.govde, sac: renk.sac,
             gorunum: gorunumVerisi.gorunum },
      // İkram teklifi geldi: kural ve coin sunucuda, burası yalnız haber.
      onIkram(p) {
        if (p?.alan !== user.id) return;
        setGelenIkram({ id: p.ikram, tur: p.tur, gonderenId: p.id, gonderenAd: p.ad });
      },
      // Gönderdiğim teklife yanıt geldi
      onIkramYanit(p) {
        const bekleyen = bekleyenIkramRef.current;
        if (!bekleyen || p?.ikram !== bekleyen.id) return;
        bekleyenIkramRef.current = null;
        if (!p.kabul) {
          setIkramNotu("Teklifin kabul edilmedi — coinin iade edildi.");
          return;
        }
        ikramOynat(bekleyen.tur, user.id, bekleyen.alan);
      },
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
      onDans(id, kod) {
        const u = uzaklar.get(id);
        if (!u || !kod) return;
        try { dunya.dansEttir(u.av, kod); }
        catch (e) { console.error("[Meydan] uzak dans:", e); }
      },
      onDurum(b, sayi) {
        if (!aktif) return;
        setBagli(b);
        setKisi(Math.max(1, sayi));
      },
    });

    // Parmak arası / tekerlek zumu — sahne katmanına bağlanır (HUD'a değil).
    const zumGirdi = zumKur(kapsayici, (carpan) => {
      try { dunya.zumla(carpan); } catch (e) { console.error("[Meydan] zum:", e); }
    });

    canliRef.current = { dunya, ben, coklu, renk, uzaklar, botlar };

    // ---- MEYDAN BOTLARI ----
    // Sunucu turnuva saatine yakın 1-2 gizli botu nöbete yazıyor
    // (meydan_bot_nobeti). Konumları tohumdan türediği için herkes aynı
    // botu aynı yerde görür; presence'a ihtiyaç yok.
    const botlariTazele = async () => {
      const liste = await meydanBotlariniAl();
      const gelen = new Set(liste.map((b) => b.user_id));
      for (const [id, b] of botlar) {
        if (!gelen.has(id)) {
          try { dunya.avatarSil(b.av); } catch { /* yut */ }
          botlar.delete(id);
        }
      }
      for (const b of liste) {
        if (botlar.has(b.user_id)) continue;
        const r = renkUret(b.user_id);
        try {
          const av = dunya.avatarOlustur(
            String(b.gorunen_ad || "Oyuncu"), r.govde, r.sac, r.etiket,
            b.gorunum ?? null, gorunumVerisi.bilgi
          );
          av.userData.ad = String(b.gorunen_ad || "Oyuncu");
          botlar.set(b.user_id, { av, tohum: b.tohum, sonJest: -1 });
        } catch (e) {
          console.error("[Meydan] bot avatari kurulamadi:", e);
        }
      }
    };
    botlariTazele();
    const botSaat = setInterval(botlariTazele, 60000);

    // ---- OYUNCUYA DOKUNMA ----
    // Sahnede bir avatara dokununca menü açılır (meydan oku / kahve / balon).
    // Sürükleme (kamera döndürme, zum) tıklama SAYILMAZ: 8 px eşik.
    let basimX = 0, basimY = 0, basimId = null;
    const basildi = (e) => { basimId = e.pointerId; basimX = e.clientX; basimY = e.clientY; };
    const birakildi = (e) => {
      if (e.pointerId !== basimId) return;
      basimId = null;
      if (Math.hypot(e.clientX - basimX, e.clientY - basimY) > 8) return;
      const c = canliRef.current;
      if (!c) return;
      const kutu = kapsayici.getBoundingClientRect();
      const nx = ((e.clientX - kutu.left) / kutu.width) * 2 - 1;
      const ny = -((e.clientY - kutu.top) / kutu.height) * 2 + 1;
      const adaylar = [...c.uzaklar.entries()].map(([id, u]) => {
        u.av.userData.oyuncuId = id;
        return u.av;
      });
      const secilen = c.dunya.avatarSec(nx, ny, adaylar);
      if (!secilen) return;
      setSecilenOyuncu({
        id: secilen.userData.oyuncuId,
        ad: secilen.userData.ad ?? "Oyuncu",
      });
    };
    kapsayici.addEventListener("pointerdown", basildi);
    kapsayici.addEventListener("pointerup", birakildi);

    // Meydan yatay çevrilince dönmüyordu. İki sebep birden vardı:
    //   1) PWA manifest'i "portrait" ile kilitliyordu (düzeltildi).
    //   2) Telefonda resize/orientationchange olayları GEÇ ya da YANLIŞ
    //      ölçüyle geliyor; sahne portre ölçüsünde kalınca ekran dönmemiş
    //      gibi görünüyordu.
    // ResizeObserver kapsayıcıyı DOĞRUDAN izliyor: ölçü ne zaman, kaç kez
    // değişirse değişsin sahne peşinden gidiyor.
    try { screen.orientation?.unlock?.(); } catch { /* desteklemiyor */ }

    const boyut = () => dunya.boyutlandir();
    let olcer = null;
    if (typeof ResizeObserver !== "undefined") {
      try {
        olcer = new ResizeObserver(() => boyut());
        olcer.observe(kapsayici);
      } catch (e) {
        console.error("[Meydan] ResizeObserver kurulamadi:", e);
      }
    }
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

      // Meydan botlarını tohumdan türeyen rotada yürüt (yarı pasif).
      if (botlar.size > 0) {
        const sn = Date.now() / 1000;
        for (const [, b] of botlar) {
          const k = botKonumu(b.tohum, sn);
          b.av.position.x = k.x;
          b.av.position.z = k.z;
          dunya.yumusakDon(b.av, k.aci, dt);
          dunya.yurumeAnimasyonu(b.av, dt, 0.8);
          const j = botJesti(b.tohum, sn);
          const pencere = Math.floor(sn / 40);
          if (j && b.sonJest !== pencere) {
            b.sonJest = pencere;
            try {
              if (j.tur === "dans" && dansVarMi(j.deger)) dunya.dansEttir(b.av, j.deger);
              else dunya.emojiGoster(b.av, j.deger);
            } catch (e) { console.error("[Meydan] bot jesti:", e); }
          }
        }
      }

      // İkram gösterileri (kahve jesti / uçan balonlar) — yalnız görsel
      try { ikramKaresi(dt); } catch (e) { console.error("[Meydan] ikram karesi:", e); }
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
        setHata({ mesaj: "Sahne çizilemedi.", ayrinti: String(e?.message ?? e), tekrar: true });
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
      try { olcer?.disconnect(); } catch { /* yut */ }
      kapsayici.removeEventListener("pointerdown", basildi);
      kapsayici.removeEventListener("pointerup", birakildi);
      try { zumGirdi?.yokEt(); } catch (e) { console.error("[Meydan] zum kapat:", e); }
      try { coklu?.kapat(); } catch (e) { console.error("[Meydan] kapat:", e); }
      try { kontrol?.yokEt(); } catch (e) { console.error("[Meydan] kontrol:", e); }
      for (const u of uzaklar.values()) { try { dunya.avatarSil(u.av); } catch { /* yut */ } }
      uzaklar.clear();
      clearInterval(botSaat);
      for (const b of botlar.values()) { try { dunya.avatarSil(b.av); } catch { /* yut */ } }
      botlar.clear();
      try { ikramlariTemizle(); } catch (e) { console.error("[Meydan] ikram temizle:", e); }
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

  /**
   * İkram gösterisini oynatır. Hangi avatarın kim olduğunu burada çözüp
   * görsel katmana (ikramGorsel.js) veriyoruz; o katman kimlik bilmez.
   */
  const ikramOynat = useCallback((tur, verenId, alanId) => {
    const c = canliRef.current;
    if (!c) return;
    const av = (id) => (id === user.id ? c.ben : c.uzaklar.get(id)?.av);
    const veren = av(verenId);
    const alan = av(alanId);
    if (!veren || !alan) return;
    try {
      if (tur === "kahve") kahveBasla(c.dunya.sahne, veren, alan, IKRAM_SURE_SN);
      else balonBasla(c.dunya.sahne, veren, alan, IKRAM_SURE_SN);
    } catch (e) {
      console.error("[Meydan] ikram gorseli:", e);
    }
  }, [user.id]);

  /** Menüden seçim: meydan oku / kahve / balon. */
  const menuSec = useCallback(async (kod) => {
    const hedef = secilenOyuncu;
    if (!hedef) return;
    setIkramNotu(null);
    if (kod === "meydan") {
      setSecilenOyuncu(null);
      konumuHatirla();
      try {
        const { data, error } = await supabase.rpc("create_challenge", {
          p_rakip: hedef.id, p_kategori: null,
        });
        if (error) throw error;
        if (data) navigate(y(`/mac/${data}`));
      } catch (e) {
        console.error("[Meydan] meydan okuma:", e);
        setIkramNotu(hataMesaji(e, "Meydan okuma başlatılamadı."));
      }
      return;
    }

    setIkramCalisiyor(true);
    try {
      const sonuc = await ikramGonder(hedef.id, kod);
      bekleyenIkramRef.current = { id: sonuc.id, tur: kod, alan: hedef.id };
      canliRef.current?.coklu?.ikramGonder({
        ikram: sonuc.id, tur: kod, alan: hedef.id, ad: adRef.current,
      });
      setSecilenOyuncu(null);
      setIkramNotu("Teklif gönderildi, yanıt bekleniyor…");
      // Yanıtsız kalırsa sunucu iptal edip coini iade ediyor.
      setTimeout(() => {
        if (bekleyenIkramRef.current?.id === sonuc.id) {
          bekleyenIkramRef.current = null;
          setIkramNotu("Yanıt gelmedi — coinin iade edildi.");
        }
      }, ZAMAN_ASIMI_SN * 1000);
    } catch (e) {
      console.error("[Meydan] ikram gonderilemedi:", e);
      setIkramNotu(hataMesaji(e, "İkram gönderilemedi."));
    } finally {
      setIkramCalisiyor(false);
    }
  }, [secilenOyuncu, navigate]);

  /** Gelen teklife yanıt. */
  const ikramYanit = useCallback(async (kabul) => {
    const t = gelenIkram;
    if (!t) return;
    setGelenIkram(null);
    try {
      const sonuc = await ikramYanitla(t.id, kabul);
      canliRef.current?.coklu?.ikramYanitGonder({ ikram: t.id, kabul: sonuc === "kabul" });
      if (sonuc === "kabul") ikramOynat(t.tur, t.gonderenId, user.id);
      else if (sonuc === "zaman_asimi") setIkramNotu("Teklifin süresi dolmuştu.");
    } catch (e) {
      console.error("[Meydan] ikram yaniti:", e);
      setIkramNotu(hataMesaji(e, "Yanıt gönderilemedi."));
    }
  }, [gelenIkram, ikramOynat, user.id]);

  /** Avatarın o anki yerini dönüş kaydına yazar (görselden bağımsız). */
  const konumuHatirla = () => {
    const c = canliRef.current;
    if (!c?.ben) return;
    donusKaydet({ x: c.ben.position.x, z: c.ben.position.z, aci: c.ben.rotation.y });
  };

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
    // Maç/turnuva bitince buraya, tam bu noktaya dönülecek (donus.js).
    konumuHatirla();
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

  /** Dans başlat: kendi avatarımız oynar, meydandakilere tek mesaj gider. */
  const dansEt = (kod) => {
    const c = canliRef.current;
    setDansAcik(false);
    if (!c) return;
    try {
      // Hız sınırı coklu'da (6.5 sn); geçtiyse kendi avatarımız da oynar
      if (c.coklu.dansGonder(kod)) c.dunya.dansEttir(c.ben, kod);
    } catch (e) {
      console.error("[Meydan] dans baslatilamadi:", e);
    }
  };

  const zumDegistir = (carpan) => {
    const c = canliRef.current;
    if (!c) return;
    try { c.dunya.zumla(carpan); } catch (e) { console.error("[Meydan] zum:", e); }
  };

  /** Yatay <-> dikey. Kilit yalnız tam ekranda ve Android'de çalışır. */
  const yonDegistir = async () => {
    setYonUyari(null);
    if (yatayKilitli) {
      await dikeyeDon();
      setYatayKilitli(false);
      setYon(yonDurumu());
      return;
    }
    const sonuc = await yatayaGec(kapsayiciRef.current?.parentElement ?? document.documentElement);
    setYatayKilitli(sonuc.oldu);
    if (!sonuc.oldu) setYonUyari(sonuc.mesaj ?? "Yatay moda geçilemedi.");
    setYon(yonDurumu());
  };

  const yatayBilgiKapat = () => {
    setYatayBilgi(false);
    try { localStorage.setItem(YATAY_UYARI_ANAHTARI, "1"); } catch { /* özel mod */ }
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
            {/* Gerçek hata metni: genel mesaj bir ReferenceError'ı saatlerce
                gizledi. Ekranda görünürse kullanıcı doğrudan iletebiliyor. */}
            {hata.ayrinti && <span className="bd-harita-hata-ayrinti">{hata.ayrinti}</span>}
            <div className="bd-harita-hata-dugmeler">
              {hata.tekrar && (
                <button type="button" className="bd-harita-btn" onClick={tekrarDene}>
                  Tekrar dene
                </button>
              )}
              <button type="button" className="bd-harita-btn beyaz" onClick={() => { donusTemizle(); navigate(y()); }}>
                Oyuna dön
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bd-harita-hud bd-harita-ust">
        {/* Ana menüye çıkış: meydana dönüş kaydı burada temizlenir —
            haritadan çıkan oyuncu maç sonunda buraya çekilmesin. */}
        <button type="button" className="bd-harita-btn beyaz" onClick={() => { donusTemizle(); navigate(y()); }}>
          ‹ Oyuna dön
        </button>
        <span className="bd-harita-hap" role="status">
          <span className={"canli" + (bagli ? "" : " kopuk")} />
          {bagli ? `${kisi} kişi burada` : "bağlantı yok"}
        </span>
      </div>

      {/* ---- zum: iki parmakla da olur, düğmeyle de ---- */}
      <div className="bd-harita-hud bd-harita-zum">
        <button type="button" className="bd-harita-yuvarlak" onClick={() => zumDegistir(1 / 1.35)} aria-label="Yakınlaştır">+</button>
        <button type="button" className="bd-harita-yuvarlak" onClick={() => zumDegistir(1.35)} aria-label="Uzaklaştır">−</button>
        <button type="button" className="bd-harita-yuvarlak kus" onClick={() => zumDegistir(99)} aria-label="Kuş bakışı" title="Kuş bakışı">🦅</button>
        <button
          type="button"
          className={"bd-harita-yuvarlak kus" + (yatayKilitli ? " acik" : "")}
          onClick={yonDegistir}
          aria-label={yatayKilitli ? "Dikey moda dön" : "Yatay moda geç"}
          title={yatayKilitli ? "Dikey moda dön" : "Yatay moda geç"}
        >
          ⟳
        </button>
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
          Yürümek için sol alttaki topuzu sürükle (veya WASD / yön tuşları). Binalara yaklaşınca kapı açılır.
          {/* Teşhis: ekran yönü durumu — sahibi ekran görüntüsüyle iletebilsin */}
          <span className="bd-harita-yon-tesis">{yonOzeti(yon)}</span>
          <button type="button" className="bd-harita-btn" onClick={bilgiKapat}>Anladım</button>
        </div>
      )}

      {/* ---- OYUNCU MENÜSÜ ----
          Avatara dokununca açılır. Seçeneklerin listesi ve fiyatları
          etkilesim.js'te (MENU); burada yalnız çizim var. */}
      {secilenOyuncu && (
        <div className="bd-harita-kisi-menu" role="dialog" aria-label="Oyuncu menüsü">
          <div className="bd-harita-kisi-ad">{secilenOyuncu.ad}</div>
          {MENU.map((m) => (
            <button
              key={m.kod}
              type="button"
              className="bd-harita-btn beyaz"
              disabled={ikramCalisiyor}
              onClick={() => menuSec(m.kod)}
            >
              {m.ad}{m.coin > 0 ? ` · ${m.coin} coin` : ""}
            </button>
          ))}
          <button type="button" className="bd-harita-dans-kapat" aria-label="Kapat"
                  onClick={() => setSecilenOyuncu(null)}>✕</button>
        </div>
      )}

      {/* ---- GELEN İKRAM ---- */}
      {gelenIkram && (
        <div className="bd-harita-ikram" role="alert">
          <b>{gelenIkram.gonderenAd || "Bir oyuncu"}</b>{" "}
          sana {gelenIkram.tur === "kahve" ? "kahve" : "balon"} ikram etmek istiyor.
          <div className="bd-harita-ikram-dugmeler">
            <button type="button" className="bd-harita-btn" onClick={() => ikramYanit(true)}>Kabul et</button>
            <button type="button" className="bd-harita-btn beyaz" onClick={() => ikramYanit(false)}>Teşekkürler</button>
          </div>
        </div>
      )}

      {ikramNotu && (
        <div className="bd-harita-yon-uyari" role="status" onClick={() => setIkramNotu(null)}>
          {ikramNotu}
        </div>
      )}

      {yonUyari && (
        <div className="bd-harita-yon-uyari" role="alert" onClick={() => setYonUyari(null)}>
          {yonUyari}
        </div>
      )}

      {yatayBilgi && (
        <div className="bd-harita-bilgi bd-harita-yatay-bilgi">
          <b>Yatay oynamak için</b>
          Ana ekrandaki kısayolu silip yeniden ekle, ya da telefonun otomatik
          döndürme ayarını aç. (Kurulu uygulama ekran kilidini kurulum anında
          hatırlıyor.)
          <button type="button" className="bd-harita-btn" onClick={yatayBilgiKapat}>Anladım</button>
        </div>
      )}

      {/* ---- DANS PANELİ ----
          Eskiden emoji sırasının içinde 💃 vardı; oyuncu onu "yeni bir emoji"
          sanıyordu. Dans emoji değil: karakterin kendisi oynuyor. Bu yüzden
          ayrı, adı yazan bir düğme ve tam genişlikte bir panel. */}
      {dansAcik && (
        <div className="bd-harita-dans-panel" role="dialog" aria-label="Dans seç">
          <div className="bd-harita-dans-panel-ust">
            <b>Dans et</b>
            <button type="button" className="bd-harita-dans-kapat" onClick={() => setDansAcik(false)} aria-label="Kapat">
              ✕
            </button>
          </div>
          <div className="bd-harita-dans-liste">
            {danslar.map((d) => (
              <button key={d.kod} type="button" className="bd-harita-dans" onClick={() => dansEt(d.kod)}>
                {d.ad}
              </button>
            ))}
          </div>
          <button type="button" className="bd-harita-dans-bos" onClick={() => navigate(y("/gorunum?yuva=dans"))}>
            {danslar.length === 0
              ? "Hiç dansın yok — Görünüm'den al"
              : "Dükkândan yeni dans al →"}
          </button>
        </div>
      )}

      <div className="bd-harita-hud bd-harita-alt">
        <div className="bd-harita-sol-dugmeler">
          <button
            type="button"
            className={"bd-harita-dans-ac" + (dansAcik ? " acik" : "")}
            onClick={() => setDansAcik((a) => !a)}
            aria-expanded={dansAcik}
          >
            <span aria-hidden="true">🕺</span> Dans
          </button>
        <div className="bd-harita-emojiler">
          {EMOJILER.map((e) => (
            <button key={e} type="button" className="bd-harita-emoji" onClick={() => emojiAt(e)} aria-label={`Emoji ${e}`}>
              {e}
            </button>
          ))}
        </div>
        </div>
        <div className="bd-harita-pad" ref={padRef} aria-label="Yürüme topuzu">
          <div className="bd-harita-topuz" ref={topuzRef} />
        </div>
      </div>
    </div>
  );
}
