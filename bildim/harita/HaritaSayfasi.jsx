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
import { ziplamaKur } from "./ziplama.js";
import { meydanBaglan } from "./coklu.js";
import { renkUret } from "./renk.js";
import { esyaBilgisi } from "./esyalar.js";
import { zumKur } from "./zum.js";
import { dansVarMi } from "./danslar.js";
import { yonDurumu, yonOzeti, yatayaGec, dikeyeDon } from "./yon.js";
import { turnuvaSaatleriniAyarla } from "../lib/zaman.js";
import { donusKaydet, donusOku, donusTemizle } from "./donus.js";
import { MENU, ikramGonder, ikramYanitla, ikramDurumu, bekleyenIkramlar, IKRAM_SURE_SN, ZAMAN_ASIMI_SN } from "./etkilesim.js";
import { kahveBasla, balonBasla, ikramKaresi, ikramlariTemizle } from "./ikramGorsel.js";
import { yaklasmaKur, yaklasmaKonumu, kabulAniIstemci } from "./yaklasma.js";
import { ayar as oyunAyari } from "../lib/ayarlar.js";

/** Kabul sonrası yaklaşmanın ardından oynayan kısa ikram gösterisi (sn). */
const YAKLASMA_IKRAM_SN = 2.5;
import {
  meydanBotlariniAl, botJesti, botPlaniKur, planKonumu, kapilariHesapla, kenarKapilariHesapla, BOT_HIZI, JEST_PENCERE_SN,
  gorunurBotlariSec, ziyaretPencereleri, ziyaretHedefiSec, ziyaretUygunMu, ziyaretBaslat,
  ziyaretAdimi, botBulusmalariniPlanla, planaBacakEkle, hopYuksekligi, kararliRastgele, geriDonusYolu,
} from "./meydanBotlari.js";
import "./harita.css";
import { tt } from "../lib/dil.js";
import OlcumGostergesi, { olcumAcikMi } from "./OlcumGostergesi.jsx";

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
  if (kalanSn <= 0) return tt("TURNUVA BAŞLADI");
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

// Paket 28 E: yükleme adımlarının okunur adları (dunya.js aşama anahtarları).
const ASAMA_METNI = {
  karakterler: "karakterler yükleniyor…",
  cevre: "çevre yükleniyor…",
  sahne: "sahne kuruluyor…",
  ilk_kare: "son dokunuşlar…",
};

export default function HaritaSayfasi() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const kapsayiciRef = useRef(null);
  const padRef = useRef(null);
  const topuzRef = useRef(null);
  const canliRef = useRef(null); // { dunya, ben, coklu }

  const [yukleniyor, setYukleniyor] = useState(true);
  // Paket 28 E: bekleme ekranı hangi adımda olduğunu söylesin. Canlıda
  // 15-20 saniye yalnız "sahne hazırlanıyor…" yazıyordu ve sayfa donmuş
  // görünüyordu. { ad, yuzde } — ad çeviri anahtarı.
  const [asama, setAsama] = useState({ ad: "karakterler", yuzde: 5 });
  const [kisi, setKisi] = useState(1);
  // Meydandaki (gizli) botlar da "kişi burada" sayısına girer: gerçek oyuncu
  // gibi görünmeleri gerekiyor. `kisi` yalnız gerçek oyuncu sayısı olarak
  // KALIR — kaç bot çizileceği ona bakıyor (botlar botları çoğaltmasın).
  const [botSayisi, setBotSayisi] = useState(0);
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
  // ---- BALIK TUTMA (Paket 13, Aşama 2) ----
  const [ikramCalisiyor, setIkramCalisiyor] = useState(false);
  const bekleyenIkramRef = useRef(null);   // gönderdiğim teklif { id, tur, alan }
  // Kabul sonrası otomatik yaklaşma (Paket 12, madde 5): { plan, karsiId,
  // etkinlik, bitince, etkinlikOynadi }. Doluyken oyuncu girdisi kilitli.
  const yaklasmaRef = useRef(null);
  const [girdiKilitli, setGirdiKilitli] = useState(false);
  // HAYALET TIKLAMA KORUMASI: menü parmak kalkınca (pointerup) açılıyor;
  // telefon hemen ardından AYNI NOKTAYA bir "click" üretiyor ve menü ekranın
  // ortasında olduğu için bu tıklama "Meydan oku"ya düşüp oto meydan
  // okuyordu (sahibinin telefonunda ölçülen hata). Menü düğmesi ancak basış
  // menünün İÇİNDE başladıysa çalışır.
  const menuBasisRef = useRef(false);
  // Meydandaki gerçek oyuncu sayısı ve bot kuralı — bot tazeleme
  // closure içinde çalıştığı için ref üzerinden okunur.
  const kisiRef = useRef(1);
  const botAyarRef = useRef({
    taban: 1, ek: 2, tavan: 6, dalgaSn: 240, dalgaUst: 1, grupEnCok: 1, ziyaretYuzde: 0, ikramYuzde: 0,
  });
  // Ayarlar gelmeden bot planı kurulmaz: farklı ayarla kurulan plan başka
  // istemcilerin gördüğünden farklı olurdu.
  const botAyarHazirRef = useRef(null);
  const turnuvaKalanRef = useRef(null);
  turnuvaKalanRef.current = turnuvaKalan;
  kisiRef.current = kisi;
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
  // 2C-A: ölçüm göstergesi (?olcum=1 açar, cihazda hatırlanır, ?olcum=0 kapatır)
  const [olcumAcik] = useState(olcumAcikMi);

  // Bot kuralı sunucudan (oyun_ayarlari): rakamlar koda gömülmez.
  useEffect(() => {
    let aktif = true;
    botAyarHazirRef.current = (async () => {
      try {
        const { data, error } = await supabase.rpc("meydan_bot_ayarlari");
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        if (aktif && r) {
          const sayi = (v, varsayilan) => (Number.isFinite(Number(v)) ? Number(v) : varsayilan);
          botAyarRef.current = {
            taban: sayi(r.taban, 1),
            ek: sayi(r.ek, 2),
            tavan: sayi(r.tavan, 6),
            dalgaSn: sayi(r.dalga_sn, 240),
            dalgaUst: sayi(r.dalga_ust, sayi(r.taban, 1)),
            grupEnCok: sayi(r.grup_en_cok, 1),
            ziyaretYuzde: sayi(r.ziyaret_yuzde, 0),
            ikramYuzde: sayi(r.ikram_yuzde, 0),
          };
        }
      } catch (e) {
        console.error("[Meydan] bot ayarlari alinamadi:", e);
      }
    })();
    return () => { aktif = false; };
  }, []);

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
          // 3B kıyafet artık SUNUCUDA: gardırop `avatar3d_gorunum_kaydet` ile
          // `profiles.gorunum.avatar3d` alanına yazıyor. Meydan `gorunum`u
          // olduğu gibi realtime ile yayınladığı için öteki oyuncular da
          // doğru kıyafeti görür. (Eski localStorage köprüsü kalktı.)
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

  const ad = profile?.gorunen_ad || tt("Oyuncu");
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
      setHata({ mesaj: tt("Cihazın 3B grafik desteklemiyor."), tekrar: false });
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
      dunya = dunyaKur(kapsayici, {
        dusukDonanim,
        hareketAzalt,
        // Paket 28 E: aşama bildirimi — bekleme ekranındaki ilerleme çubuğu.
        onAsama: (ad, yuzde) => { if (aktif) setAsama({ ad, yuzde }); },
      });   // 2B: tek harita Taksim (yerlesim.json)
      try { localStorage.removeItem("bildim_harita_yerlesim"); } catch { /* özel mod */ }   // 2A harita seçimi kalktı
      // 2B §2.3: tam (kozmetik + gölge + kırpma) karakter sayısı oyun_ayarlari'ndan — koda gömülmez
      const kurulanDunya = dunya;
      oyunAyari("meydan_uc_boyutlu_sinir", 8).then((n) => kurulanDunya.kalabalikSiniri(n)).catch((e) => console.error("[Meydan] kalabalik siniri:", e));
      // 2B §4: sokak kedisi sayısı oyun_ayarlari'ndan
      oyunAyari("meydan_kedi_sayisi", 8).then((n) => kurulanDunya.kediSayisi(n)).catch((e) => console.error("[Meydan] kedi sayisi:", e));
    } catch (e) {
      console.error("[Meydan] sahne kurulamadi:", e);
      setYukleniyor(false);
      setHata({ mesaj: tt("Sahne kurulamadı."), ayrinti: String(e?.message ?? e), tekrar: true });
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
      setHata({ mesaj: tt("Avatarın çizilemedi."), ayrinti: String(e?.message ?? e), tekrar: true });
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
      // Manifestteki spawn_varsayilan
      const dogus = dunya.yerlesim.dogus;
      ben.position.set(dogus.x, 0, dogus.z);
      ben.rotation.y = dogus.aci;
    }


    kontrol = kontrolKur(padRef.current, topuzRef.current);
    // Zıplama durumu SAF MANTIK (bkz. ziplama.js) — sahneden bağımsız.
    const ziplama = ziplamaKur();

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
          setIkramNotu(tt("Teklifin kabul edilmedi — coinin iade edildi."));
          return;
        }
        ikramKabulOynat(bekleyen.id, bekleyen.tur, user.id, bekleyen.alan);
      },
      onKatilim(id, bilgi) {
        if (uzaklar.has(id)) return;
        const varsayilan = renkUret(id);
        const govde = typeof bilgi?.renk === "number" ? bilgi.renk : varsayilan.govde;
        const sac = typeof bilgi?.sac === "number" ? bilgi.sac : varsayilan.sac;
        // Uzak oyuncunun görünümü presence yükünde geldi (kare kare değil).
        const av = dunya.avatarOlustur(
          String(bilgi?.ad || tt("Oyuncu")), govde, sac, "#" + govde.toString(16).padStart(6, "0"),
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
        // h = zıplama yüksekliği. Eski sürüm göndermiyor olabilir → 0.
        const h = Number.isFinite(Number(p.h)) ? Number(p.h) : 0;
        const varis = performance.now();
        // Eski sürüm damga göndermiyor olabilir: varış zamanına düş
        const gt = Number.isFinite(Number(p.t)) ? Number(p.t) : varis;
        const son = u.tampon[u.tampon.length - 1];
        if (son && gt <= son.t) return;   // sıra bozucu / yinelenen paketi at
        u.ornekler.push(varis - gt);
        if (u.ornekler.length > OFSET_ORNEK) u.ornekler.shift();
        u.tampon.push({ t: gt, x, z, y: donus, h });
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

    canliRef.current = { dunya, ben, coklu, renk, uzaklar, botlar, ziplama };
    // 2A: ölçüm/görüntü için hata ayıklama kancası (oynanışa etkisi yok)
    window.__harita = { dunya, ben, uzaklar, botlar, YURUME_HIZI };

    // ---- MEYDAN BOTLARI ----
    // Sunucu nöbeti katmanlara böler (meydan_bot_nobeti.katman); kaçının
    // ÇİZİLECEĞİNE mantık katmanı karar verir (gorunurBotlariSec): tek
    // başına oyuncu için zamana bağlı dalga (taban..dalgaUst), her ek gerçek
    // oyuncu `ek` kadar ekler, `tavan`ı aşmaz. Karar botun GİRİŞ anına göre
    // verilir; herkes aynı listeye aynı kuralı uyguladığı için aynı botları
    // aynı yerde görür. Presence'a ihtiyaç yok.
    //
    // ORGANİK DAVRANIŞ (hepsi tohumdan kararlı, Math.random yok):
    //   • grup girişi: aynı katman + başlangıç → aynı kapıdan birkaç adım arayla
    //   • ziyaret: ara sıra yakındaki gerçek oyuncuya gidip emoji + hoplama
    //   • buluşma: iki bot karşılıklı durup kahve/balon ikram eder
    // Botların girip çıktığı kapılar ve kaçındığı engeller dünyadan okunur
    // (mantık katmanı yalnız sayı görür; harita değişirse bu da değişir).
    // Paket 12, madde 2: giriş/çıkış bina kapısı DEĞİL — oyuncunun doğduğu
    // yöne yakın dış kenar (binaların arası). Bina kapısı yedek olarak kalır.
    // Paket 13: tüm dış kenar (her 2°'lik engelsiz nokta) — bot hep aynı yerden gelmesin.
    const kenarKapilar = kenarKapilariHesapla(dunya.engeller, dunya.yerlesim ? { x: dunya.yerlesim.dogus.x, z: dunya.yerlesim.dogus.z } : { x: 0, z: 16.5 }, Infinity);
    const kapilar = kenarKapilar.length ? kenarKapilar : kapilariHesapla(dunya.binalar, dunya.engeller);
    // Görünür botların TABAN planları (bir kez kurulur): id -> { id, tohum,
    // plan, ziyaretler, basSira, sira }. Buluşmalar bunların üstüne eklenir.
    const tabanlar = new Map();
    let bulusmalar = [];
    const oynananBulusmalar = new Set();
    let ilkTazeleme = true;
    // İlk tazelemeden sonra yalnız KAPIDAN GİREN bot eklenir; meydanın
    // ortasında aniden belirmesin.
    const GIRIS_PENCERESI_MS = 20000;
    const botlariTazele = async () => {
      try {
        await Promise.race([
          botAyarHazirRef.current ?? Promise.resolve(),
          new Promise((coz) => setTimeout(coz, 4000)),
        ]);
      } catch { /* ayar alınamadı: varsayılanlarla devam */ }
      const liste = await meydanBotlariniAl();
      if (!aktif) return;
      try {
        const ayar = botAyarRef.current;
        const simdi = Date.now();
        const gorunur = gorunurBotlariSec(liste, { kisi: kisiRef.current ?? 1, ayar });

        // Nöbetten düşenler her hâlükârda silinir.
        const gelen = new Set(liste.map((b) => b.user_id));
        for (const [id, b] of botlar) {
          if (!gelen.has(id)) {
            try { dunya.avatarSil(b.av); } catch { /* yut */ }
            botlar.delete(id);
          }
        }
        for (const id of [...tabanlar.keys()]) {
          if (!gelen.has(id) || (!gorunur.has(id) && !botlar.has(id))) tabanlar.delete(id);
        }

        // Görünür botların taban planları (nöbet değişmediyse yeniden kurulmaz).
        for (const b of liste) {
          const g = gorunur.get(b.user_id);
          if (!g) continue;
          const eski = tabanlar.get(b.user_id);
          if (eski && eski.tohum === b.tohum) continue;
          try {
            const plan = botPlaniKur({
              tohum: b.tohum, baslangicMs: b.baslangicMs, bitisMs: b.bitisMs,
              kapilar, engeller: dunya.engeller, grup: g,
            });
            tabanlar.set(b.user_id, {
              id: b.user_id, tohum: b.tohum, plan,
              ziyaretler: ziyaretPencereleri(b.tohum, plan, ayar),
              basSira: g.basSira, sira: g.sira,
            });
          } catch (e) {
            console.error("[Meydan] bot plani kurulamadi:", e);
          }
        }

        // Buluşmalar yalnız görünür botlar arasında (herkeste aynı küme).
        try {
          bulusmalar = botBulusmalariniPlanla(
            [...tabanlar.values()].filter((t) => gorunur.has(t.id)), ayar, dunya.engeller
          );
        } catch (e) {
          console.error("[Meydan] bot bulusmalari:", e);
          bulusmalar = [];
        }
        const botBacaklari = new Map();   // id -> [{ id: bulusmaId, bacak }]
        for (const m of bulusmalar) {
          for (const id of [m.a, m.b]) {
            if (!botBacaklari.has(id)) botBacaklari.set(id, []);
            botBacaklari.get(id).push({ id: m.id, bacak: m.bacaklar[id] });
          }
        }

        // Yeni botlar. Bitmesine 15 sn'den az kalan eklenmez — belirip hemen gitmesin.
        for (const b of liste) {
          if (botlar.has(b.user_id)) continue;
          const t = tabanlar.get(b.user_id);
          if (!t || !gorunur.has(b.user_id)) continue;
          if (!(b.bitisMs - simdi > 15000)) continue;
          if (!ilkTazeleme && simdi > t.plan.baslaMs + GIRIS_PENCERESI_MS) continue;
          const r = renkUret(b.user_id);
          try {
            const av = dunya.avatarOlustur(
              String(b.gorunen_ad || tt("Oyuncu")), r.govde, r.sac, r.etiket,
              b.gorunum ?? null, gorunumVerisi.bilgi,
              { bot: true, tohum: b.user_id, katman: b.katman ?? 0 }   // 2B §4B: bot yeni karakterle; tür katmandan (0 insan, diğerleri kaplan/robot), kıyafet/saç/ten/kozmetik kimliğinden — herkeste aynı
            );
            av.userData.ad = String(b.gorunen_ad || tt("Oyuncu"));
            const ilk = planKonumu(t.plan, simdi);
            av.position.set(ilk.x, 0, ilk.z);
            av.rotation.y = ilk.aci;
            av.visible = simdi >= t.plan.baslaMs;
            botlar.set(b.user_id, {
              av, tohum: b.tohum, taban: t, plan: t.plan, ziyaretler: t.ziyaretler,
              bacaklar: [], bulusmaIdleri: new Set(), sonJest: -1,
              ziyaret: null, ziyaretBitti: new Set(), hop: null,
            });
          } catch (e) {
            console.error("[Meydan] bot avatari kurulamadi:", e);
          }
        }

        // Buluşma bacaklarını planlara işle. Başlamış/süren bir bacak
        // eklenip çıkarılamaz (bot yerinden sıçrardı) — o istemcide atlanır.
        for (const [id, b] of botlar) {
          const yeniler = botBacaklari.get(id) ?? [];
          const imza = yeniler.map((x) => x.id).sort().join(",");
          if (imza === [...b.bulusmaIdleri].sort().join(",")) continue;
          if (b.ziyaret) continue;
          const eklenen = yeniler.filter((x) => !b.bulusmaIdleri.has(x.id));
          const cikan = b.bacaklar.filter((x) => !yeniler.some((y) => y.id === x.id));
          const dokunulmaz = [...eklenen, ...cikan].some(
            (x) => !(x.bacak.gitMs > simdi + 300 || x.bacak.donMs < simdi)
          );
          if (dokunulmaz) continue;
          b.plan = planaBacakEkle(b.taban.plan, yeniler.map((x) => x.bacak));
          b.bacaklar = yeniler;
          b.bulusmaIdleri = new Set(yeniler.map((x) => x.id));
        }
        ilkTazeleme = false;
      } catch (e) {
        console.error("[Meydan] bot tazeleme:", e);
      }
    };
    botlariTazele();
    // 6 saniye: botlar birer birer katılsın/ayrılsın (aniden belirmesin).
    const botSaat = setInterval(botlariTazele, 6000);
    // Sayaç saniyede bir; yalnız değişince React'e yazılır (her karede değil).
    const botSayacSaat = setInterval(() => {
      if (aktif) setBotSayisi((o) => (o === botlar.size ? o : botlar.size));
    }, 1000);

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
      // Meydan botları da seçilebilir (sahibinin isteği) — menü gerçek
      // oyuncununkiyle aynı, bot olduğu belli olmaz. Görünmeyen avatar
      // (ilk konum paketi gelmemiş) seçilmez: ışın görünürlüğe bakmıyor.
      const adaylar = [
        ...[...c.uzaklar.entries()].map(([id, u]) => { u.av.userData.oyuncuId = id; return u.av; }),
        ...[...c.botlar.entries()].map(([id, b]) => { b.av.userData.oyuncuId = id; return b.av; }),
      ].filter((av) => av.visible);
      const secilen = c.dunya.avatarSec(nx, ny, adaylar);
      if (!secilen) return;
      menuBasisRef.current = false;
      setSecilenOyuncu({
        id: secilen.userData.oyuncuId,
        ad: secilen.userData.ad ?? tt("Oyuncu"),
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
      setHata({ mesaj: tt("Sahne yüklenemedi."), tekrar: true });
    };
    perdeSaat = setTimeout(perdeBek, PERDE_SURESI);


    const cizim = (t) => {
      if (!aktif) return;
      raf = requestAnimationFrame(cizim);
      // SAYFA GİZLİYKEN RENDER YOK — ama İLK KARE her hâlükârda çizilir.
      // Eskiden gizli sekmede hiç kare gelmiyordu: perde ("sahne
      // hazırlanıyor…") sonsuza kadar kalıyor, sahne bomboş duruyordu.
      // Şimdi bir kare çizilip perde kalkıyor; sonrası yine duraklıyor.
      if (document.hidden && !ilkKare) { sonT = t; return; }
      try {
      dunya.olcum.kareBasla();   // 2C-A: CPU+GPU ölçümü istenmişse kare süresi buradan başlar
      const dt = Math.min((t - sonT) / 1000, 0.05);
      sonT = t; zaman += dt;

      // ---- kendi hareketim
      const { ix, iz } = kontrol.oku();
      let guc = Math.min(Math.hypot(ix, iz), 1);
      // Kabul sonrası yaklaşma sürüyorsa girdi okunur ama UYGULANMAZ.
      const yk = yaklasmaRef.current;
      // Boşluk tuşu ya da HUD düğmesi: havadayken ikinci zıplama yok
      // (kural ziplama.js içinde, burada değil).
      if (kontrol.ziplandiMi() && !yk) ziplama.basla();
      const yukseklik = ziplama.ilerlet(dt);
      if (yk) {
        // Paket 12, madde 5: iki avatar birbirine yürür, yüz yüze durur,
        // etkinlik oynar; süre sabit, hız mesafeye göre ölçeklenir.
        const kb = yaklasmaKonumu(yk.plan, Date.now(), "ben");
        ben.position.x = kb.x;
        ben.position.z = kb.z;
        dunya.carpismaDuzelt(ben.position, 0.8);
        dunya.yumusakDon(ben, kb.aci, dt, 12);
        guc = kb.yuruyor ? Math.min(1, kb.hiz / YURUME_HIZI + 0.25) : 0;
        if (!yk.etkinlikOynadi && (kb.evre === "etkinlik" || kb.evre === "bitti")) {
          yk.etkinlikOynadi = true;
          try { yk.etkinlik?.(); } catch (e) { console.error("[Meydan] yaklasma etkinligi:", e); }
        }
        if (kb.evre === "bitti") {
          yaklasmaRef.current = null;
          // Bot karşı taraftaysa planına YÜRÜYEREK döner (ışınlanmaz).
          const kb2 = botlar.get(yk.karsiId);
          if (kb2) {
            const p = { x: kb2.av.position.x, z: kb2.av.position.z, aci: kb2.av.rotation.y };
            try {
              kb2.ziyaret = { hedefId: null, durum: { evre: "donus", ...p, donus: geriDonusYolu(kb2.plan, p, Date.now(), dunya.engeller) } };
            } catch (e) { console.error("[Meydan] bot plana donemedi:", e); }
          }
          try { yk.bitince?.(); } catch (e) { console.error("[Meydan] yaklasma sonu:", e); }
        }
      } else if (guc > 0.05) {
        const yon = Math.atan2(ix, iz);
        ben.position.x += Math.sin(yon) * guc * YURUME_HIZI * dt;
        ben.position.z += Math.cos(yon) * guc * YURUME_HIZI * dt;
        dunya.carpismaDuzelt(ben.position, 0.8);
        dunya.yumusakDon(ben, yon, dt, 12);
      }
      // Zemin yüksekliği + zıplama. Ağ paketinin `h` alanı toplamı taşır — yeni alan yok;
      // alıcı zemini kendi haritasından ayırır (Taksim'de zemin düz).
      const zemin = dunya.zeminYuksekligi(ben.position.x, ben.position.z);
      dunya.yurumeAnimasyonu(ben, dt, guc, yukseklik, zemin);
      coklu.pozGonder(ben.position.x, ben.position.z, ben.rotation.y, yukseklik + zemin);

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

        let hx, hz, hy, hh;
        if (tp.length >= 2 && tp[0].t <= gecmis) {
          // İki gerçek paket arasındayız: aradaki hareketi düz üret
          const a = tp[0], b = tp[1];
          const aralik = b.t - a.t || 1;
          const oran = Math.min(1, Math.max(0, (gecmis - a.t) / aralik));
          hx = a.x + (b.x - a.x) * oran;
          hz = a.z + (b.z - a.z) * oran;
          hy = a.y + aciFark(b.y, a.y) * oran;
          // Zıplama yüksekliği de aynı iki paket arasında düz üretilir;
          // parabolün kendisi gönderende hesaplanıyor (bkz. ziplama.js).
          hh = (a.h ?? 0) + ((b.h ?? 0) - (a.h ?? 0)) * oran;
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
          // Tampon kuruduğunda havada asılı kalmasın: yere indir.
          hh = 0;
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
        // Paketteki h = zemin + zıplama; zemin bu haritadan okunur, kalan zıplamadır.
        const uzakZemin = dunya.zeminYuksekligi(av.position.x, av.position.z);
        dunya.yurumeAnimasyonu(av, dt, hiz > 0.4 ? Math.min(1, hiz / YURUME_HIZI) : 0, Math.max(0, hh - uzakZemin), uzakZemin);
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

      // Meydan botları: kapıdan gir → dolaş/dur (ara sıra oyuncuya selam,
      // başka botla ikram) → bir binaya yürü → kaybol. Konum sunucu saatine
      // bağlı plandan okunur; herkes aynı yerde görür.
      if (botlar.size > 0) {
        const simdiMs = Date.now();
        const sn = simdiMs / 1000;
        let oyuncuIdleri = null;   // ziyaret hedefi olabilecek gerçek oyuncular (gerekince)
        const oyuncuAvatari = (id) => (id === user.id ? ben : (uzaklar.get(id)?.yerlesti ? uzaklar.get(id).av : null));
        for (const [id, b] of botlar) {
          const k = planKonumu(b.plan, simdiMs);
          if (k.bitti) {
            // Meydanın dış kenarından ayrıldı: avatar kalkar, sıradaki tazelemede yerine başkası gelir.
            try { dunya.avatarSil(b.av); } catch { /* yut */ }
            botlar.delete(id);
            continue;
          }
          // Grup üyeleri kapıdan sırayla çıkar: sırası gelmeyen görünmez.
          const girdi = simdiMs >= b.plan.baslaMs;
          if (b.av.visible !== girdi) b.av.visible = girdi;
          if (!girdi) continue;

          let x = k.x, z = k.z, aci = k.aci, yuruyor = k.yuruyor, zipla = 0;

          // Ziyaret penceresi açıldı mı? (pencereyi kaçıran istemci atlar)
          if (!b.ziyaret) {
            const p = b.ziyaretler.find(
              (w) => simdiMs >= w.basMs && simdiMs < w.basMs + 1500 && !b.ziyaretBitti.has(w.basMs)
            );
            if (p) {
              b.ziyaretBitti.add(p.basMs);
              if (!oyuncuIdleri) {
                oyuncuIdleri = [user.id];
                for (const [uid, u] of uzaklar) if (u.yerlesti) oyuncuIdleri.push(uid);
              }
              const hedefId = ziyaretHedefiSec(p, oyuncuIdleri);
              const hedefAv = hedefId ? oyuncuAvatari(hedefId) : null;
              if (hedefAv && ziyaretUygunMu(k, hedefAv.position)) {
                b.ziyaret = { hedefId, durum: ziyaretBaslat(k, p, simdiMs) };
              }
            }
          }
          if (b.ziyaret) {
            try {
              const hedefAv = oyuncuAvatari(b.ziyaret.hedefId);
              const s = ziyaretAdimi(b.ziyaret.durum, {
                simdiMs, dt, hedef: hedefAv ? hedefAv.position : null,
                plan: b.plan, engeller: dunya.engeller,
              });
              if (s.bitti) {
                b.ziyaret = null;               // plana tam katıldı: plan konumu geçerli
              } else {
                x = s.x; z = s.z; aci = s.aci; yuruyor = s.yuruyor; zipla = s.zipla;
                if (s.emoji) dunya.emojiGoster(b.av, s.emoji);
              }
            } catch (e) {
              console.error("[Meydan] bot ziyareti:", e);
              b.ziyaret = null;
            }
          }

          // Oyuncunun kabul ettiği/aldığı ikramda karşı taraf bu botsa: plan
          // yerine yaklaşma konumu (Paket 12, madde 5).
          const ykB = yaklasmaRef.current;
          if (ykB && ykB.karsiId === id && !b.ziyaret) {
            const kk = yaklasmaKonumu(ykB.plan, simdiMs, "karsi");
            x = kk.x; z = kk.z; aci = kk.aci; yuruyor = kk.yuruyor;
          }
          b.av.position.x = x;
          b.av.position.z = z;
          dunya.yumusakDon(b.av, aci, dt, 8);
          if (!zipla && b.hop) {
            const gecen = simdiMs - b.hop.basMs;
            zipla = hopYuksekligi(gecen, b.hop.adet);
            if (gecen > 3000) b.hop = null;
          }
          // Adım temposu gerçek hızla orantılı — yerinde kayar gibi yürümesin.
          // Koşar/ağır bacakta tempo planın gerçek hızına uyar (Paket 7, 2d);
          // ziyaret sırasında plan hızı geçersiz, normal tempo.
          const adimHizi = b.ziyaret ? BOT_HIZI : (k.hiz || BOT_HIZI);
          dunya.yurumeAnimasyonu(b.av, dt, yuruyor ? Math.min(1, adimHizi / YURUME_HIZI) : 0, zipla, dunya.zeminYuksekligi(x, z));
          const j = botJesti(b.tohum, sn);
          const pencere = Math.floor(sn / JEST_PENCERE_SN);
          // Paket 13: zıplama yürürken/koşarken de olur — gerçek oyuncular koşarken zıplar.
          if (j && j.tur === "zipla" && yuruyor && !b.ziyaret && !b.hop && b.sonJest !== pencere) {
            b.sonJest = pencere;
            b.hop = { basMs: simdiMs, adet: Number(j.deger) || 1 };
          }
          if (yuruyor || b.ziyaret) continue;   // yürürken / selam verirken diğer jestler yok
          // Buluşma bacağındayken de jest yok (ikram gösterisi oynuyor).
          if (b.bacaklar.some((x2) => simdiMs >= x2.bacak.gitMs && simdiMs <= x2.bacak.donMs)) continue;
          if (j && b.sonJest !== pencere) {
            b.sonJest = pencere;
            try {
              if (j.tur === "dans" && dansVarMi(j.deger)) dunya.dansEttir(b.av, j.deger);
              else if (j.tur === "zipla") b.hop = { basMs: simdiMs, adet: Number(j.deger) || 1 };
              else if (j.tur === "emoji") dunya.emojiGoster(b.av, j.deger);
            } catch (e) { console.error("[Meydan] bot jesti:", e); }
          }
        }

        // Buluşmalar: iki bot da noktasına vardıysa ikram gösterisi başlar.
        // Geç açılan istemci kalan süreyle oynatır.
        for (const m of bulusmalar) {
          // İkram emojisi (Paket 7, 2b): anı gelince bir kez; geç açılan istemci
          // 3 sn'den eskisini oynatmaz.
          if (m.emoji && !oynananBulusmalar.has(m.id + ":emoji")
              && simdiMs >= m.emoji.anMs && simdiMs <= m.emoji.anMs + 3000) {
            const eb = botlar.get(m.emoji.bot);
            if (eb && eb.bulusmaIdleri.has(m.id)) {
              oynananBulusmalar.add(m.id + ":emoji");
              try { dunya.emojiGoster(eb.av, m.emoji.deger); }
              catch (e) { console.error("[Meydan] ikram emojisi:", e); }
            }
          }
          if (oynananBulusmalar.has(m.id)) continue;
          if (simdiMs < m.basMs || simdiMs > m.bitMs - 1500) continue;
          const A = botlar.get(m.a), B = botlar.get(m.b);
          if (!A || !B || !A.bulusmaIdleri.has(m.id) || !B.bulusmaIdleri.has(m.id)) continue;
          if (A.ziyaret || B.ziyaret) continue;
          const yerinde = (bot, id) =>
            Math.hypot(bot.av.position.x - m.nokta[id].x, bot.av.position.z - m.nokta[id].z) < 0.4;
          if (!yerinde(A, m.a) || !yerinde(B, m.b)) continue;
          oynananBulusmalar.add(m.id);
          const kalanSn = (m.bitMs - simdiMs) / 1000;
          try {
            if (m.tur === "kahve") {
              kahveBasla(dunya.sahne, A.av, B.av, kalanSn);
            } else {
              const veren = botlar.get(m.veren), alan = botlar.get(m.alan);
              if (veren && alan) balonBasla(dunya.sahne, veren.av, alan.av, kalanSn, kararliRastgele(m.id));
            }
          } catch (e) { console.error("[Meydan] bot ikrami:", e); }
        }
      }

      // İkram gösterileri (kahve jesti / uçan balonlar) — yalnız görsel
      try { ikramKaresi(dt); } catch (e) { console.error("[Meydan] ikram karesi:", e); }
      dunya.guncelle(dt, zaman, ben);
      dunya.olcum.kareBitti();   // 2C-A: yalnız ölçüm sürerken gl.finish
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
        setHata({ mesaj: tt("Sahne çizilemedi."), ayrinti: String(e?.message ?? e), tekrar: true });
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
      clearInterval(botSayacSaat);
      for (const b of botlar.values()) { try { dunya.avatarSil(b.av); } catch { /* yut */ } }
      botlar.clear();
      try { ikramlariTemizle(); } catch (e) { console.error("[Meydan] ikram temizle:", e); }
      try { dunya?.yokEt(); } catch (e) { console.error("[Meydan] yokEt:", e); }
      if (window.__harita?.dunya === dunya) delete window.__harita;
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
        // Gardıropta yapılan değişiklik de buradan yakalanır (köprü).
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
  const ikramOynat = useCallback((tur, verenId, alanId, sure = IKRAM_SURE_SN) => {
    const c = canliRef.current;
    if (!c) return;
    const av = (id) => (id === user.id ? c.ben : (c.uzaklar.get(id)?.av ?? c.botlar.get(id)?.av));
    const veren = av(verenId);
    const alan = av(alanId);
    if (!veren || !alan) return;
    try {
      if (tur === "kahve") kahveBasla(c.dunya.sahne, veren, alan, sure);
      else balonBasla(c.dunya.sahne, veren, alan, sure);
    } catch (e) {
      console.error("[Meydan] ikram gorseli:", e);
    }
  }, [user.id]);

  /**
   * Kabul sonrası otomatik yaklaşmayı başlatır (Paket 12, madde 5).
   * Karşı taraf sahnede yoksa false döner, hiçbir geri çağrı çalışmaz.
   * `basMs`: iki istemcide ortak an (sunucu kabul anı, istemci saatinde).
   */
  const yaklasmaBaslat = useCallback(({ karsiId, basMs, etkinlik, bitince }) => {
    const c = canliRef.current;
    if (!c?.ben) return false;
    const karsiAv = c.uzaklar.get(karsiId)?.av ?? c.botlar.get(karsiId)?.av;
    if (!karsiAv) return false;
    const bot = c.botlar.get(karsiId);
    if (bot) bot.ziyaret = null;   // yarım kalan ziyaret; yaklaşma bulunduğu yerden başlar
    const plan = yaklasmaKur({
      basMs, simdiMs: Date.now(),
      ben: { x: c.ben.position.x, z: c.ben.position.z },
      karsi: { x: karsiAv.position.x, z: karsiAv.position.z },
    });
    yaklasmaRef.current = {
      plan, karsiId, etkinlik, etkinlikOynadi: false,
      bitince: () => { setGirdiKilitli(false); bitince?.(); },
    };
    setSecilenOyuncu(null);
    setDansAcik(false);
    setGirdiKilitli(true);
    return true;
  }, []);

  /** Kabul edilen ikram: sunucu kabul anını okur, yaklaşıp gösteriyi oynatır. */
  const ikramKabulOynat = useCallback(async (ikramId, tur, verenId, alanId) => {
    let basMs = Date.now();
    try {
      const { data, error } = await supabase.rpc("ikram_kabul_bilgisi", { p_id: ikramId });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.yanit_at) basMs = kabulAniIstemci(r.yanit_at, r.sunucu_zamani);
    } catch (e) {
      console.error("[Meydan] ikram kabul ani okunamadi:", e);
    }
    const karsiId = verenId === user.id ? alanId : verenId;
    const basladi = yaklasmaBaslat({
      karsiId, basMs,
      etkinlik: () => ikramOynat(tur, verenId, alanId, YAKLASMA_IKRAM_SN),
    });
    if (!basladi) ikramOynat(tur, verenId, alanId);
  }, [user.id, ikramOynat, yaklasmaBaslat]);

  // ---- ARKADAŞ EKLE (Paket 7, 2c) ----
  // Menü açılınca seçilen kişiyle arkadaşlık durumu okunur (RLS: yalnız kendi
  // satırların). null = okunuyor | 'yok' | 'gonderildi' | 'gelen' | 'arkadas'.
  // Gizli bota da istek GİDER (gerçek oyuncu gibi); gizli botlar arkadaşlık
  // kabul etmez — mevcut kural, burada dokunulmadı.
  const [arkadasDurum, setArkadasDurum] = useState(null);
  // Arkadaşlık satırının kimliği: gönderilen isteği geri çekmek için (Paket 13).
  const [arkadaslikId, setArkadaslikId] = useState(null);
  const secilenId = secilenOyuncu?.id ?? null;
  useEffect(() => {
    setArkadasDurum(null);
    setArkadaslikId(null);
    if (!secilenId || !user?.id) return undefined;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("friendships")
          .select("id, requester, addressee, durum")
          .or(`and(requester.eq.${user.id},addressee.eq.${secilenId}),and(requester.eq.${secilenId},addressee.eq.${user.id})`)
          .limit(1);
        if (error) throw error;
        if (!aktif) return;
        const f = data?.[0];
        setArkadaslikId(f?.id ?? null);
        setArkadasDurum(!f ? "yok" : f.durum === "arkadas" ? "arkadas" : f.requester === user.id ? "gonderildi" : "gelen");
      } catch (e) {
        console.error("[Meydan] arkadaslik durumu okunamadi:", e);
        if (aktif) setArkadasDurum("yok");
      }
    })();
    return () => { aktif = false; };
  }, [secilenId, user?.id]);

  const arkadasEkle = useCallback(async () => {
    const hedef = secilenOyuncu;
    if (!hedef) return;
    const kabulMu = arkadasDurum === "gelen";
    try {
      // Karşı taraf zaten istek attıysa sunucu doğrudan arkadaş yapar.
      const { error } = await supabase.rpc("send_friend_request", { p_target: hedef.id });
      if (error) throw error;
      setArkadasDurum(kabulMu ? "arkadas" : "gonderildi");
      setIkramNotu(kabulMu ? tt("{0} ile artık arkadaşsınız.", { 0: hedef.ad }) : tt("{0} kişisine arkadaşlık isteği gönderildi.", { 0: hedef.ad }));
      // Geri çekilebilsin diye yeni satırın kimliği okunur (RPC kimlik döndürmüyor).
      const { data: satir, error: okuHata } = await supabase
        .from("friendships")
        .select("id")
        .eq("requester", user.id)
        .eq("addressee", hedef.id)
        .maybeSingle();
      if (okuHata) throw okuHata;
      setArkadaslikId(satir?.id ?? null);
    } catch (e) {
      console.error("[Meydan] arkadaslik istegi:", e);
      setIkramNotu(hataMesaji(e, tt("Arkadaşlık isteği gönderilemedi.")));
    }
  }, [secilenOyuncu, arkadasDurum, user.id]);

  /**
   * Gönderdiğim arkadaşlık isteğini geri çeker (Paket 13). Meydan okumadaki
   * "Geri çek" gibi. remove_friend yalnız istek sahibinin/alıcının kendi
   * satırını siler; istek arada kabul edildiyse ekranda "Arkadaşsınız" kalır.
   */
  const istegiGeriCek = useCallback(async () => {
    const hedef = secilenOyuncu;
    if (!hedef || !arkadaslikId) return;
    try {
      const { data: guncel, error: okuHata } = await supabase
        .from("friendships").select("durum").eq("id", arkadaslikId).maybeSingle();
      if (okuHata) throw okuHata;
      if (guncel?.durum === "arkadas") {
        setArkadasDurum("arkadas");
        setIkramNotu(tt("{0} isteğini zaten kabul etmiş — artık arkadaşsınız.", { 0: hedef.ad }));
        return;
      }
      const { error } = await supabase.rpc("remove_friend", { p_id: arkadaslikId });
      if (error) throw error;
      setArkadasDurum("yok");
      setArkadaslikId(null);
      setIkramNotu(tt("{0} kişisine gönderdiğin arkadaşlık isteği geri çekildi.", { 0: hedef.ad }));
    } catch (e) {
      console.error("[Meydan] arkadaslik istegi geri cekilemedi:", e);
      setIkramNotu(hataMesaji(e, tt("İstek geri çekilemedi.")));
    }
  }, [secilenOyuncu, arkadaslikId]);

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
        if (data) {
          // Paket 12, madde 5: rakibe yürüyüp selam verir, sonra maça geçer.
          const git = () => { konumuHatirla(); navigate(y(`/mac/${data}`)); };
          const basladi = yaklasmaBaslat({
            karsiId: hedef.id, basMs: Date.now(),
            etkinlik: () => emojiAt("👋"),
            bitince: git,
          });
          if (!basladi) git();
        }
      } catch (e) {
        console.error("[Meydan] meydan okuma:", e);
        setIkramNotu(hataMesaji(e, tt("Meydan okuma başlatılamadı.")));
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
      setIkramNotu(tt("Teklif gönderildi, yanıt bekleniyor…"));
      // Yanıt broadcast'le gelir (onIkramYanit). Gelmezse — paket kaybı ya
      // da alanın istemcisi yok — sunucuya sorulur. İkisinden hangisi önce
      // işlerse `bekleyenIkramRef` boşalır, öteki sessizce çıkar.
      const son = Date.now() + ZAMAN_ASIMI_SN * 1000;
      (async () => {
        while (bekleyenIkramRef.current?.id === sonuc.id && Date.now() < son) {
          await new Promise((r) => setTimeout(r, 1200));
          if (bekleyenIkramRef.current?.id !== sonuc.id) return;
          let d;
          try {
            d = await ikramDurumu(sonuc.id);
          } catch (e) {
            console.error("[Meydan] ikram durumu okunamadi:", e);
            continue;
          }
          if (d === "bekliyor" || bekleyenIkramRef.current?.id !== sonuc.id) continue;
          bekleyenIkramRef.current = null;
          if (d === "kabul") {
            setIkramNotu(null);
            ikramKabulOynat(sonuc.id, kod, user.id, hedef.id);
          } else if (d === "red") {
            setIkramNotu(tt("Teklifin kabul edilmedi — coinin iade edildi."));
          } else {
            setIkramNotu(tt("Yanıt gelmedi — coinin iade edildi."));
          }
          return;
        }
        // Süre doldu, yanıt yok: sunucu iptal edip coini iade ediyor.
        if (bekleyenIkramRef.current?.id === sonuc.id) {
          bekleyenIkramRef.current = null;
          setIkramNotu(tt("Yanıt gelmedi — coinin iade edildi."));
        }
      })();
    } catch (e) {
      console.error("[Meydan] ikram gonderilemedi:", e);
      setIkramNotu(hataMesaji(e, tt("İkram gönderilemedi.")));
    } finally {
      setIkramCalisiyor(false);
    }
  }, [secilenOyuncu, navigate, ikramKabulOynat, yaklasmaBaslat, user.id]);

  /** Gelen teklife yanıt. */
  const ikramYanit = useCallback(async (kabul) => {
    const t = gelenIkram;
    if (!t) return;
    setGelenIkram(null);
    try {
      const sonuc = await ikramYanitla(t.id, kabul);
      canliRef.current?.coklu?.ikramYanitGonder({ ikram: t.id, kabul: sonuc === "kabul" });
      if (sonuc === "kabul") ikramKabulOynat(t.id, t.tur, t.gonderenId, user.id);
      else if (sonuc === "zaman_asimi") setIkramNotu(tt("Teklifin süresi dolmuştu."));
    } catch (e) {
      console.error("[Meydan] ikram yaniti:", e);
      setIkramNotu(hataMesaji(e, tt("Yanıt gönderilemedi.")));
    }
  }, [gelenIkram, ikramKabulOynat, user.id]);

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

  /**
   * Zıpla — mobil düğmesi. PC'de aynı işi boşluk tuşu yapıyor (kontrol.js).
   * Havadaysa `basla()` zaten false döner; ikinci zıplama yok.
   */
  const zipla = () => {
    const c = canliRef.current;
    if (!c) return;
    try { c.ziplama.basla(); } catch (e) { console.error("[Meydan] ziplama:", e); }
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
    if (!sonuc.oldu) setYonUyari(sonuc.mesaj ?? tt("Yatay moda geçilemedi."));
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

  // ---- MEYDAN KAPISI ----
  // Meydana girmek için karakter şart: meydandaki gövde oyuncunun gardıropta
  // kurduğu karakterdir, kurmamış oyuncu orada "varsayılan biri" olarak
  // dolaşmasın. Bu kapı YALNIZ meydana konur — maç, lig, dükkân serbest.
  if (gorunumVerisi && !gorunumVerisi.gorunum?.avatar3d && !gorunumVerisi.gorunum?.harita) {
    return (
      <div className="bd-harita">
        <div className="bd-harita-yukleniyor">
          <div className="bd-harita-hata">
            <b>{tt("Önce karakterini oluştur")}</b>
            <span>
              {tt("Meydanda herkes kendi karakteriyle dolaşıyor. Karakterini seçip kaydedince buraya girebilirsin.")}
            </span>
            <div className="bd-harita-hata-dugmeler">
              <button type="button" className="bd-harita-btn" onClick={() => { donusTemizle(); navigate(y("/gorunum")); }}>{tt("Karakterimi seç")}</button>
              <button
                type="button"
                className="bd-harita-btn beyaz"
                onClick={() => { donusTemizle(); navigate(y()); }}
              >
                {tt("Oyuna dön")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bd-harita">
      <div className="bd-harita-sahne" ref={kapsayiciRef} />

      {yukleniyor && !hata && (
        <div className="bd-harita-yukleniyor">
          <div>
            <b>{tt("Meydan")}</b>
            {/* Paket 28 E: adım adı + ilerleme. Yüzde kabaca doğrudur;
                amaç "donmuş mu" sorusunu ortadan kaldırmak. */}
            <span>{tt(ASAMA_METNI[asama.ad] ?? "sahne hazırlanıyor…")}</span>
            <div
              className="bd-harita-ilerleme"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={asama.yuzde}
              aria-label={tt("Meydan yükleniyor")}
            >
              <i style={{ width: `${asama.yuzde}%` }} />
            </div>
          </div>
        </div>
      )}

      {hata && (
        <div className="bd-harita-yukleniyor" role="alert">
          <div className="bd-harita-hata">
            <b>{tt("Meydan açılamadı")}</b>
            <span>{hata.mesaj}</span>
            {/* Gerçek hata metni: genel mesaj bir ReferenceError'ı saatlerce
                gizledi. Ekranda görünürse kullanıcı doğrudan iletebiliyor. */}
            {hata.ayrinti && <span className="bd-harita-hata-ayrinti">{hata.ayrinti}</span>}
            <div className="bd-harita-hata-dugmeler">
              {hata.tekrar && (
                <button type="button" className="bd-harita-btn" onClick={tekrarDene}>
                  {tt("Tekrar dene")}
                </button>
              )}
              <button type="button" className="bd-harita-btn beyaz" onClick={() => { donusTemizle(); navigate(y()); }}>
                {tt("Oyuna dön")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bd-harita-hud bd-harita-ust">
        {/* Ana menüye çıkış: meydana dönüş kaydı burada temizlenir —
            haritadan çıkan oyuncu maç sonunda buraya çekilmesin. */}
        <button type="button" className="bd-harita-btn beyaz" onClick={() => { donusTemizle(); navigate(y()); }}>
          {tt("‹ Oyuna dön")}
        </button>
        <span className="bd-harita-hap" role="status">
          <span className={"canli" + (bagli ? "" : " kopuk")} />
          {bagli ? tt("{0} kişi burada", { 0: kisi + botSayisi }) : tt("bağlantı yok")}
        </span>
      </div>

      {olcumAcik && <OlcumGostergesi canliRef={canliRef} />}

      {/* ---- zum: iki parmakla da olur, düğmeyle de ---- */}
      <div className="bd-harita-hud bd-harita-zum">
        <button type="button" className="bd-harita-yuvarlak" onClick={() => zumDegistir(1 / 1.35)} aria-label={tt("Yakınlaştır")}>+</button>
        <button type="button" className="bd-harita-yuvarlak" onClick={() => zumDegistir(1.35)} aria-label={tt("Uzaklaştır")}>−</button>
        <button type="button" className="bd-harita-yuvarlak kus" onClick={() => zumDegistir(99)} aria-label={tt("Kuş bakışı")} title={tt("Kuş bakışı")}>🦅</button>
        <button
          type="button"
          className={"bd-harita-yuvarlak kus" + (yatayKilitli ? " acik" : "")}
          onClick={yonDegistir}
          aria-label={yatayKilitli ? tt("Dikey moda dön") : tt("Yatay moda geç")}
          title={yatayKilitli ? tt("Dikey moda dön") : tt("Yatay moda geç")}
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
          <small>{ipucu.alt} {tt("— girmek için dokun")}</small>
        </button>
      )}

      {bilgiAcik && (
        <div className="bd-harita-bilgi">
          <b>{tt("Meydandasın")}</b>
          {tt("Yürümek için sol alttaki topuzu sürükle (veya WASD / yön tuşları). Binalara yaklaşınca kapı açılır.")}
          {/* Teşhis: ekran yönü durumu — sahibi ekran görüntüsüyle iletebilsin */}
          <span className="bd-harita-yon-tesis">{yonOzeti(yon)}</span>
          <button type="button" className="bd-harita-btn" onClick={bilgiKapat}>{tt("Anladım")}</button>
        </div>
      )}

      {/* ---- OYUNCU MENÜSÜ ----
          Avatara dokununca açılır. Seçeneklerin listesi ve fiyatları
          etkilesim.js'te (MENU); burada yalnız çizim var. */}
      {secilenOyuncu && (
        <div className="bd-harita-kisi-menu" role="dialog" aria-label={tt("Oyuncu menüsü")}
             onPointerDown={() => { menuBasisRef.current = true; }}>
          <div className="bd-harita-kisi-ad">{secilenOyuncu.ad}</div>
          {MENU.map((m) => (
            <button
              key={m.kod}
              type="button"
              className="bd-harita-btn beyaz"
              disabled={ikramCalisiyor}
              onClick={(e) => {
                // detail 0 = klavye (Enter/Space): basış olayı olmaz, geçerli.
                if (e.detail !== 0 && !menuBasisRef.current) return;
                menuBasisRef.current = false;
                menuSec(m.kod);
              }}
            >
              {m.ad}{m.coin > 0 ? ` · ${m.coin} coin` : ""}
            </button>
          ))}
          <button
            type="button"
            className="bd-harita-btn beyaz"
            disabled={arkadasDurum === null || arkadasDurum === "arkadas" || (arkadasDurum === "gonderildi" && !arkadaslikId)}
            onClick={(e) => {
              if (e.detail !== 0 && !menuBasisRef.current) return;
              menuBasisRef.current = false;
              if (arkadasDurum === "gonderildi") istegiGeriCek();
              else arkadasEkle();
            }}
          >
            {arkadasDurum === "arkadas" ? tt("Arkadaşsınız ✓")
              : arkadasDurum === "gonderildi" ? tt("İsteği geri çek")
              : arkadasDurum === "gelen" ? tt("Arkadaşlık isteğini kabul et")
              : arkadasDurum === null ? tt("Arkadaş ekle…") : tt("Arkadaş ekle")}
          </button>
          <button type="button" className="bd-harita-dans-kapat" aria-label={tt("Kapat")}
                  onClick={(e) => {
                    // Aynı hayalet tıklama menüyü açılır açılmaz kapatıyordu.
                    if (e.detail !== 0 && !menuBasisRef.current) return;
                    menuBasisRef.current = false;
                    setSecilenOyuncu(null);
                  }}>✕</button>
        </div>
      )}


      {/* ---- GELEN İKRAM ---- */}
      {gelenIkram && (
        <div className="bd-harita-ikram" role="alert">
          <b>{gelenIkram.gonderenAd || tt("Bir oyuncu")}</b>{" "}
          {gelenIkram.tur === "kahve" ? tt("sana kahve ikram etmek istiyor.") : tt("sana balon ikram etmek istiyor.")}
          <div className="bd-harita-ikram-dugmeler">
            <button type="button" className="bd-harita-btn" onClick={() => ikramYanit(true)}>{tt("Kabul et")}</button>
            <button type="button" className="bd-harita-btn beyaz" onClick={() => ikramYanit(false)}>{tt("Teşekkürler")}</button>
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
          <b>{tt("Yatay oynamak için")}</b>
          {tt("Ana ekrandaki kısayolu silip yeniden ekle, ya da telefonun otomatik döndürme ayarını aç. (Kurulu uygulama ekran kilidini kurulum anında hatırlıyor.)")}
          <button type="button" className="bd-harita-btn" onClick={yatayBilgiKapat}>{tt("Anladım")}</button>
        </div>
      )}

      {/* ---- DANS PANELİ ----
          Eskiden emoji sırasının içinde 💃 vardı; oyuncu onu "yeni bir emoji"
          sanıyordu. Dans emoji değil: karakterin kendisi oynuyor. Bu yüzden
          ayrı, adı yazan bir düğme ve tam genişlikte bir panel. */}
      {dansAcik && (
        <div className="bd-harita-dans-panel" role="dialog" aria-label={tt("Dans seç")}>
          <div className="bd-harita-dans-panel-ust">
            <b>{tt("Dans et")}</b>
            <button type="button" className="bd-harita-dans-kapat" onClick={() => setDansAcik(false)} aria-label={tt("Kapat")}>
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
          {/* DANS DÜKKÂNI ŞİMDİLİK YOK.
              Danslar eski görünüm sayfasının "Dans" sekmesinde satılıyordu;
              o sayfa tek karakter sistemine geçişte arayüzden çıktı ve 3B
              gardıropta dans yuvası yok (saç/kıyafet/baş/gözlük/sırt).
              Sahip olunan danslar ÇALIŞMAYA DEVAM EDİYOR — yalnız yeni dans
              alınamıyor. Eski sayfaya menüden yol bırakmamak için düğme
              kaldırıldı; dansın yeni evi ayrı bir karar. */}
          <div className="bd-harita-dans-bos">
            {danslar.length === 0
              ? tt("Henüz dansın yok. Yeni dans dükkânı yakında.")
              : tt("Yeni dans dükkânı yakında.")}
          </div>
        </div>
      )}

      <div className={"bd-harita-hud bd-harita-alt" + (girdiKilitli ? " kilitli" : "")}
           aria-disabled={girdiKilitli || undefined}>
        <div className="bd-harita-sol-dugmeler">
          {/* Zıpla ve Dans aynı satırda: ikisi de EYLEM düğmesi ve HUD'un
              yüksekliği büyümesin (yatay ekranda sahneyi eziyordu).
              Yön topuzu solda, eylemler sağda — .bd-harita-alt row-reverse. */}
          <div className="bd-harita-eylem-satiri">
            <button
              type="button"
              className="bd-harita-zipla"
              onClick={zipla}
              aria-label={tt("Zıpla")}
              title={tt("Zıpla — boşluk tuşu")}
            >
              <span aria-hidden="true">⤴</span> {tt("Zıpla")}
            </button>
            <button
              type="button"
              className={"bd-harita-dans-ac" + (dansAcik ? " acik" : "")}
              onClick={() => setDansAcik((a) => !a)}
              aria-expanded={dansAcik}
            >
              <span aria-hidden="true">🕺</span> {tt("Dans")}
            </button>
          </div>
        <div className="bd-harita-emojiler">
          {EMOJILER.map((e) => (
            <button key={e} type="button" className="bd-harita-emoji" onClick={() => emojiAt(e)} aria-label={`Emoji ${e}`}>
              {e}
            </button>
          ))}
        </div>
        </div>
        <div className="bd-harita-pad" ref={padRef} aria-label={tt("Yürüme topuzu")}>
          <div className="bd-harita-topuz" ref={topuzRef} />
        </div>
      </div>
    </div>
  );
}
