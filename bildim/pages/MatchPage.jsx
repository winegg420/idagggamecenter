import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SenRozeti from "../components/SenRozeti.jsx";
import SayanSayi from "../components/SayanSayi.jsx";
import SureDolduGecis from "../components/SureDolduGecis.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import AvatarCerceve from "../components/AvatarCerceve.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import BildirimIzniSor from "../components/BildirimIzniSor.jsx";
import MacSonuEklentisi from "../components/MacSonuEklentisi.jsx";
import MacSonuDokum from "../components/MacSonuDokum.jsx";
import Maskot from "../components/Maskot.jsx";
import Ikon from "../components/Ikon.jsx";
import { TEPKILER, tepkiIkonu } from "../lib/tepkiler.js";
import MacYukleniyor from "../components/MacYukleniyor.jsx";
import SesliSohbet from "../components/SesliSohbet.jsx";
import { useOyunModu } from "../lib/oyunModu.js";
import { useGorunurlukTazele, zamanAsimiyla } from "../lib/gorunurluk.js";
import { useMacNabiz } from "../lib/nabiz.js";
import { HazirKapisi, KopukPerde, GeriSayim } from "../components/MacHazirlik.jsx";
import { macBittiReklam } from "../lib/reklam.js";
import { y } from "../lib/yol.js";
import { GB_MS } from "../lib/geriBildirim.js";

// is_bot: maç sonunda hangi rövanş eyleminin gösterileceğini belirler
// (bota doğrudan yeni maç, gerçek oyuncuya istek). Ekstra sorgu açmamak için
// zaten çekilen profil satırına eklendi.
const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, gorunen_ad, gorunen_avatar, is_bot),
  p2:profiles!matches_oyuncu2_fkey(id, gorunen_ad, gorunen_avatar, is_bot)`;

// Tepkiler artık SVG ikon (bkz. lib/tepkiler.js). Sunucuya giden metin aynı.
// Balonda gösterim: mesaj bir tepki emojisiyse ikonu, değilse metni çiz.
function balonIcerik(mesaj) {
  const ad = tepkiIkonu(mesaj);
  return ad ? <Ikon ad={ad} boyut={20} /> : mesaj;
}
const KALIPLAR = [
  "İyi şanslar!",
  "Bunu biliyordum!",
  "Şanslıydın! 😏",
  "İyi oyun!",
  "Hadi bakalım!",
  "Vay be! 🤯",
  "AĞLAMA 😂",
  "HAHAHAHAHA",
];

/**
 * Maç satırının "ne kadar ilerlemiş" damgası.
 *
 * Skorlar, soru sayaçları ve "basladi" maç boyunca YALNIZ ARTAR. Satır iki
 * kaynaktan geliyor: Realtime ve 2 saniyelik yoklama. İkisi birden çalışınca
 * yanıtlar SIRASIZ gelebiliyor — yeni bir güncellemeden sonra çözülen eski
 * bir yoklama tabelayı geri alıyor ve puan "gecikmeli" görünüyordu.
 * Damgası daha küçük olan anlık görüntü artık atılır.
 *
 * Duraklama bilerek dışarıda: o hem açılıp hem kapanıyor, tek yönlü değil.
 */
function ilerlemeDamgasi(m) {
  if (!m) return -1;
  const kapandi = m.durum === "bitti" || m.durum === "iptal" || m.durum === "reddedildi" ? 1 : 0;
  return (
    kapandi * 1e9 +
    (m.basladi ? 1 : 0) * 1e8 +
    (m.aktif_soru ?? 0) * 1e6 +
    ((m.oyuncu1_soru ?? 0) + (m.oyuncu2_soru ?? 0)) * 1e4 +
    (m.oyuncu1_skor ?? 0) + (m.oyuncu2_skor ?? 0)
  );
}

export default function MatchPage() {
  const { id } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mac, setMac] = useState(null);
  const [soru, setSoru] = useState(null);
  const [cevapladim, setCevapladim] = useState(false);
  const [jokerKullanildi, setJokerKullanildi] = useState({ elli: false, sure: false });
  const [jokerHata, setJokerHata] = useState(null);
  const [balonlar, setBalonlar] = useState({}); // { [user_id]: mesaj }
  const [kaliplarAcik, setKaliplarAcik] = useState(false);
  const [ilerleme, setIlerleme] = useState({ ben: 0, rakip: 0 });
  // Rakip cevap verdiğinde avatarında kısa bir nabız — rakip görünmez bir
  // hayalet olmaktan çıksın.
  const [rakipNabiz, setRakipNabiz] = useState(false);
  const rakipIlerlemeRef = useRef(0);
  const [bilgiKapandi, setBilgiKapandi] = useState(false);
  // Bilgi kartı yalnız maça ilk girişte gösterilir. Sonradan belirip soru
  // ekranını aşağı itmesin diye ilk render'da sabitlenir (canlı testte
  // düzen kayması yüzünden şıkka tıklanamıyordu).
  const ilkGirisRef = useRef(null);
  const [yuklemeHatasi, setYuklemeHatasi] = useState(null);
  // Duraklama bitince soruyu yeniden çekmek için sayaç (saat ileri kaydı)
  const [duraklamaTuru, setDuraklamaTuru] = useState(0);
  // Kendi cevabımızın/atlamamızın zamanı. Sonraki soru bu andan GB_MS
  // geçmeden ekrana gelmez: bot anında cevaplayınca sunucu soruyu hemen
  // ilerletiyor ve Realtime paketiyle kart göz açıp kapayana kadar
  // değişiyordu — oyuncu doğru mu yanlış mı yaptığını göremiyordu.
  const cevapZamaniRef = useRef(0);
  // Maç bitti ama son cevabın geri bildirimi hâlâ ekranda mı?
  // Bota karşı oynarken bot anında cevapladığı için son cevapla birlikte maç
  // kapanıyor ve doğru mu yanlış mı yaptığımız HİÇ görünmeden sonuç ekranı
  // açılıyordu. Sonuç ekranı pencere dolana kadar bekler.
  const [sonucHazir, setSonucHazir] = useState(false);
  // Uygulanmış en ileri damga (bkz. ilerlemeDamgasi)
  const damgaRef = useRef(-1);
  const advanceKilidi = useRef(false);
  const pollRef = useRef(null);
  const kanalRef = useRef(null);
  // Kanal düştüğünde yeniden kurma zamanlayıcısı ve güncel kanalKur referansı
  const yenidenBaglaRef = useRef(null);
  const kanalKurRef = useRef(null);
  // Son yüklenen maç satırının imzası — yoklama aynı veriyi getirdiğinde
  // gereksiz yeniden çizimi engeller (bkz. macYukle).
  const macImzaRef = useRef(null);
  // Maç bitişinde sonuç ekranından önce 0.8 sn'lik "Maç bitti!" perdesi
  const [gecisBitti, setGecisBitti] = useState(false);
  const balonTimer = useRef({});

  const balonGoster = useCallback((kimden, mesaj) => {
    setBalonlar((b) => ({ ...b, [kimden]: mesaj }));
    clearTimeout(balonTimer.current[kimden]);
    balonTimer.current[kimden] = setTimeout(() => {
      setBalonlar((b) => {
        const yeni = { ...b };
        delete yeni[kimden];
        return yeni;
      });
    }, 4000);
  }, []);

  const mesajGonder = async (mesaj) => {
    setKaliplarAcik(false);
    balonGoster(user.id, mesaj);
    await supabase.rpc("send_match_message", { p_match_id: id, p_mesaj: mesaj });
  };

  useEffect(() => {
    supabase
      .from("match_jokers")
      .select("tip")
      .eq("match_id", id)
      .eq("user_id", user.id)
      .then(({ data }) => {
        const k = { elli: false, sure: false };
        (data ?? []).forEach((j) => (k[j.tip] = true));
        setJokerKullanildi(k);
      });
  }, [id, user.id]);

  const jokerKullan = async (tip) => {
    setJokerHata(null);
    const { data, error } = await supabase.rpc("use_joker", {
      p_match_id: id,
      p_tip: tip,
    });
    if (error) {
      setJokerHata(hataMesaji(error));
      return null;
    }
    setJokerKullanildi((k) => ({ ...k, [tip]: true }));
    refreshProfile(user.id);
    return data;
  };

  const macYukle = useCallback(async () => {
    let data = null;
    try {
      const sonuc = await supabase
        .from("matches")
        .select(MAC_SECIMI)
        .eq("id", id)
        .single();
      if (sonuc.error) throw sonuc.error;
      data = sonuc.data;
      if (data) setYuklemeHatasi(null);
    } catch (e) {
      console.error("[Bildim] mac yuklenemedi:", e);
      setYuklemeHatasi(hataMesaji(e, "Maç bilgisi alınamadı."));
    }
    // Yoklama 2 saniyede bir dönüyor. Gelen satır bir öncekiyle birebir
    // aynıysa state'e DOKUNMA: yeni nesne yazmak React'e "değişti" dedirtir
    // ve maç ekranı boşuna baştan çizilir. Sesli sohbet (WebRTC) açıkken bu
    // gereksiz çizim yükü hissedilir takılmaya dönüşüyordu.
    if (data) {
      const imza = JSON.stringify(data);
      if (imza !== macImzaRef.current) {
        // Bu yoklama, elimizdekinden ESKİ bir anı gösteriyorsa yazma:
        // yoksa tabela geri sayıp puan sonradan geliyormuş gibi görünüyor.
        const damga = ilerlemeDamgasi(data);
        if (damga < damgaRef.current) return data;
        damgaRef.current = damga;
        macImzaRef.current = imza;
        setMac(data);

        // Asenkron maçta iki taraf farklı soruda olabilir.
        // match_answers RLS'i yalnız KENDİ cevaplarını gösterdiği için rakip
        // ilerlemesi hep 0 çıkıyordu; sayaçlar matches tablosunda tutuluyor.
        const benP1x = data.oyuncu1 === user.id;
        setIlerleme({
          ben: benP1x ? (data.oyuncu1_soru ?? 0) : (data.oyuncu2_soru ?? 0),
          rakip: benP1x ? (data.oyuncu2_soru ?? 0) : (data.oyuncu1_soru ?? 0),
        });
      }
    }
    return data;
  }, [id, user.id]);

  // Kanal kurulumu ayrı fonksiyonda: sekmeden dönüşte ölmüş soket yeniden kurulur.
  const kanalKur = useCallback(() => {
    const kanal = supabase
      .channel(`mac-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${id}` },
        (payload) => {
          // Realtime paketleri de sırasız gelebilir (yeniden bağlanma,
          // arka plandan dönüş). Geriye giden paket çizime alınmaz.
          const damga = ilerlemeDamgasi(payload.new);
          if (damga < damgaRef.current) return;
          damgaRef.current = damga;
          setMac((eski) => ({ ...eski, ...payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=eq.${id}` },
        (payload) => balonGoster(payload.new.user_id, payload.new.mesaj)
      )
      // Kanal ölürse sessizce kalmasın: Realtime kopmasi (ag dalgalanmasi,
      // uyku, arka plan) CHANNEL_ERROR/TIMED_OUT/CLOSED olarak bildirilir.
      // Yoklama zaten veriyi getiriyor ama kanal geri kurulmazsa anlık
      // güncellemeler (rakip skoru, mesaj) bir daha hiç gelmiyordu.
      .subscribe((durum) => {
        if (durum === "CHANNEL_ERROR" || durum === "TIMED_OUT" || durum === "CLOSED") {
          console.warn("[Bildim] mac kanali dustu:", durum);
          if (yenidenBaglaRef.current) clearTimeout(yenidenBaglaRef.current);
          yenidenBaglaRef.current = setTimeout(() => {
            if (kanalRef.current !== kanal) return; // baska kanal kurulmus
            try {
              supabase.removeChannel(kanal);
              kanalKurRef.current?.();
            } catch (e) {
              console.error("[Bildim] kanal yeniden kurulamadi:", e);
            }
          }, 2000);
        }
      });
    kanalRef.current = kanal;
    return kanal;
  }, [id, balonGoster]);

  // Kanal izleyicisi kanalKur'u çağırabilsin (kanalKur kendi tanımına
  // referans veremediği için güncel hâli her render'da ref'e yazılır).
  kanalKurRef.current = kanalKur;

  useEffect(() => {
    macYukle();
    kanalKur();
    // Realtime kopsa bile skor akmaya devam etsin (rakip puanı canlı artar)
    pollRef.current = setInterval(macYukle, 2000);
    return () => {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalRef.current = null;
      if (yenidenBaglaRef.current) clearTimeout(yenidenBaglaRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, macYukle, kanalKur]);

  // Sekmeden dönünce: veriyi tazele ve ölmüş olabilecek Realtime kanalını yenile.
  useGorunurlukTazele(() => {
    macYukle();
    try {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalKur();
    } catch (e) {
      console.error("[Bildim] realtime yeniden kurulamadi:", e);
    }
  }, mac?.durum === "aktif");

  // Soru değişince çek.
  // SENKRON maçta indeks ORTAK (`aktif_soru`): iki oyuncu da aynı soruda.
  // Eski (asenkron) maçlarda herkes kendi `oyuncuN_soru` indeksinde.
  const senkron = Boolean(mac?.senkron);
  const kendiIndeks = !mac
    ? 0
    : senkron
      ? (mac.aktif_soru ?? 0)
      : mac.oyuncu1 === user.id
        ? (mac.oyuncu1_soru ?? 0)
        : (mac.oyuncu2_soru ?? 0);
  // Senkron maç iki taraf da ekrana gelene kadar başlamaz.
  const senkronBekliyor = mac?.durum === "aktif" && senkron && !mac?.basladi;
  // Son sorunun geri bildirimi sürerken kart YERİNDE kalmalı: soru state'i
  // temizlenirse kart sökülür ve doğru cevap hiç görünmez.
  const sonKartBekliyor = mac?.durum === "bitti" && !sonucHazir;
  useEffect(() => {
    if (sonKartBekliyor) return undefined;
    if (!mac || mac.durum !== "aktif" || senkronBekliyor) {
      setSoru(null);
      return undefined;
    }
    // Kendi bölümümüz bittiyse soru çekme (sunucu da hata döndürür)
    if (kendiIndeks >= (mac.soru_ids?.length ?? 0)) {
      setSoru(null);
      return undefined;
    }
    // Geri bildirim penceresinin kalanı kadar bekle (ilk soruda 0).
    const kalanGB = Math.max(0, GB_MS - (Date.now() - cevapZamaniRef.current));
    let iptal = false;
    const zamanlayici = setTimeout(() => {
      if (iptal) return;
      advanceKilidi.current = false;
      setCevapladim(false);
      supabase
        .rpc("get_match_question", { p_match_id: mac.id })
        .then(({ data, error }) => {
          if (iptal) return;
          if (error) {
            console.error("[Bildim] soru alinamadi:", error);
            return;
          }
          if (data?.[0]) setSoru(data[0]);
        });
    }, kalanGB);
    return () => { iptal = true; clearTimeout(zamanlayici); };
  }, [mac?.id, mac?.durum, kendiIndeks, mac?.soru_ids?.length, senkronBekliyor, duraklamaTuru, sonKartBekliyor]);

  // ---- NABIZ ----
  // 3 sn'de bir "buradayım" der, "Hazır"a basıldığını iletir ve ekranın ne
  // çizeceğini (kapı / kilit / oyun) sunucudan öğrenir. Sekme arka planda
  // olduğunda BİLEREK atılmaz — rakip o an ekranımızın kilitlenmesini görür.
  const nabizParam = useMemo(() => ({ p_match_id: id }), [id]);
  const { nabiz, hazirla } = useMacNabiz("mac_nabiz", nabizParam, Boolean(mac));

  const duraklatildi = Boolean(nabiz?.duraklatildi) && mac?.durum === "aktif";
  const duraklamaSn = nabiz?.duraklama_sn ?? 0;

  // 3-2-1: maç başladı ama soru saati henüz gelmedi (sunucu 3 sn ileri kurdu).
  // Sunucu saatiyle kendi saatimiz arasındaki farkı nabızdan öğreniyoruz;
  // cihaz saati yanlışsa bile geri sayım doğru çalışır.
  const [geriSayim, setGeriSayim] = useState(null);
  useEffect(() => {
    if (!nabiz?.basladi || !nabiz?.baslangic || !nabiz?.sunucu_zamani) {
      setGeriSayim(null);
      return undefined;
    }
    const fark = new Date(nabiz.sunucu_zamani).getTime() - Date.now();
    const bitis = new Date(nabiz.baslangic).getTime();
    const hesapla = () => {
      const kalan = (bitis - (Date.now() + fark)) / 1000;
      setGeriSayim(kalan > 0.05 ? kalan : null);
    };
    hesapla();
    const id = setInterval(hesapla, 100);
    return () => clearInterval(id);
  }, [nabiz?.basladi, nabiz?.baslangic, nabiz?.sunucu_zamani]);

  /** Rakip gelmiyor: maçı sıra tabanlı (asenkron) bırak. */
  const asenkronaGec = async () => {
    try {
      const { error } = await supabase.rpc("mac_asenkrona_gec", { p_match_id: id });
      if (error) throw error;
      await macYukle();
    } catch (e) {
      console.error("[Bildim] asenkrona gecilemedi:", e);
    }
  };

  // Sunucu durumu değişince maç satırını tazele (maç başladı / hükmen bitti).
  const oncekiNabizRef = useRef(null);
  useEffect(() => {
    if (!nabiz) return;
    const onceki = oncekiNabizRef.current;
    oncekiNabizRef.current = nabiz;
    if (!onceki) return;
    // Maç başladı, duraklama bitti ya da maç sonlandı: hepsi yeni veri ister.
    if (onceki.basladi !== nabiz.basladi
      || onceki.duraklatildi !== nabiz.duraklatildi
      || onceki.durum !== nabiz.durum) {
      macYukle();
      // Duraklama bittiğinde soru saati İLERİ kaydırılmıştır; soruyu yeniden
      // çekmezsek kart eski (dolmuş) sayaçla kalır.
      if (onceki.duraklatildi && !nabiz.duraklatildi) setDuraklamaTuru((n) => n + 1);
    }
  }, [nabiz, macYukle]);

  const maciIptalEt = async () => {
    try {
      await supabase.rpc("mac_iptal", { p_match_id: id });
    } catch (e) {
      console.error("[Bildim] mac iptal edilemedi:", e);
    }
    navigate(y("/meydan"));
  };

  // Rakip bir soru ilerlediyse (yani cevap verdiyse) avatarı bir kez atsın
  useEffect(() => {
    const onceki = rakipIlerlemeRef.current;
    rakipIlerlemeRef.current = ilerleme.rakip;
    if (ilerleme.rakip <= onceki) return;
    setRakipNabiz(true);
    const t = setTimeout(() => setRakipNabiz(false), 700);
    return () => clearTimeout(t);
  }, [ilerleme.rakip]);

  useOyunModu(Boolean(soru) && mac?.durum === "aktif");

  useEffect(() => {
    if (mac?.durum !== "bitti") { setSonucHazir(false); return undefined; }
    const kalan = Math.max(0, GB_MS - (Date.now() - cevapZamaniRef.current));
    if (kalan === 0) { setSonucHazir(true); return undefined; }
    const t = setTimeout(() => setSonucHazir(true), kalan);
    return () => clearTimeout(t);
  }, [mac?.durum]);

  // Maç bitince puan tazele + (sıklık kuralı uygunsa) geçiş reklamı
  const reklamGosterildiRef = useRef(false);
  useEffect(() => {
    if (mac?.durum === "bitti") {
      refreshProfile(user.id);
      if (pollRef.current) clearInterval(pollRef.current);
      if (!reklamGosterildiRef.current) {
        reklamGosterildiRef.current = true;
        macBittiReklam().catch(() => {}); // reklam akışı oyunu asla bloklamaz
      }
    }
  }, [mac?.durum, refreshProfile, user.id]);

  // Asenkron akışta ortak ilerletme yok; advance_match yalnız BİTİŞ kontrolü
  // yapıyor. Rakip kendi bölümünü bitirmiş olabilir diye ara ara yoklanır.
  const ilerletmeyiDene = useCallback(() => {
    supabase
      .rpc("advance_match", { p_match_id: id })
      .then(() => macYukle())
      .catch(() => {});
  }, [id, macYukle]);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_match_answer", {
      p_match_id: id,
      p_cevap: i,
    });
    if (error) throw error;
    cevapZamaniRef.current = Date.now();
    setCevapladim(true);

    // Skor tabelası ANINDA güncellensin: sunucu kazanılan puanla birlikte
    // güncel iki skoru da döndürüyor (migration 137). Eskiden tabela
    // Realtime'ı ya da yoklamayı bekliyordu; puan bir tur geç görünüyordu.
    const satir = data?.[0];
    if (satir && Number.isFinite(Number(satir.benim_skor))) {
      setMac((m) => {
        if (!m) return m;
        const benimP1 = m.oyuncu1 === user.id;
        const yeni = {
          ...m,
          oyuncu1_skor: benimP1 ? Number(satir.benim_skor) : Number(satir.rakip_skor),
          oyuncu2_skor: benimP1 ? Number(satir.rakip_skor) : Number(satir.benim_skor),
        };
        damgaRef.current = Math.max(damgaRef.current, ilerlemeDamgasi(yeni));
        return yeni;
      });
    }

    // Kendi sıramız sunucuda ilerledi; bir sonraki soruyu çekmek için tazele.
    setTimeout(macYukle, GB_MS);
    return satir;
  };

  // Asenkron maç: süre dolunca YALNIZ kendi sıramız atlanır, rakip beklenmez.
  // Atlama RPC'si atlanan sorunun DOĞRU CEVABINI döndürür; QuestionCard onu
  // yeşile boyayıp geri bildirim penceresini açar. Sonraki soru pencere
  // kadar (GB_MS) beklendikten sonra yüklenir — eskiden ekran anında
  // atlıyor, doğru cevap hiç gösterilmiyordu.
  const sureDoldu = useCallback(async () => {
    if (advanceKilidi.current) return null;
    advanceKilidi.current = true;
    try {
      // Zaman aşımı şart: sekme arka plandayken açılan RPC soket koptuğu için
      // ne çözülüyor ne reddediliyordu, kilit sonsuza kadar kapalı kalıyordu.
      const { data, error } = await zamanAsimiyla(
        supabase.rpc("mac_soruyu_atla", { p_match_id: id }),
        10000,
        "mac_soruyu_atla"
      );
      if (error) throw error;
      const satir = Array.isArray(data) ? data[0] : data;

      // BOŞ DÖNÜŞ = sunucu atlamayı kabul etmedi. En sık sebep saat farkı:
      // istemcinin sayacı 15. saniyede biterken sunucu 17 saniye dolmadan
      // atlamıyordu; arada kalan ~2 saniyede RPC hata da vermiyor, boş
      // dönüyordu. Kilit kapalı kaldığı için soru ne ilerliyor ne yeniden
      // deneniyordu: ekran "Süre doldu"da donuyordu.
      if (!satir || satir.dogru_cevap == null) {
        advanceKilidi.current = false;   // kilidi AÇ: tik yeniden denesin
        macYukle();
        throw new Error("Soru atlanamadi, yeniden denenecek");
      }

      cevapZamaniRef.current = Date.now();
      setTimeout(macYukle, GB_MS);
      return satir.dogru_cevap;
    } catch (e) {
      // Kilidi AÇ: atlama olmadı, soru hâlâ sunucuda duruyor. Kapalı bırakılsaydı
      // oyuncu sekmeden döndüğünde ne ilerleme ne yeniden deneme olurdu.
      advanceKilidi.current = false;
      console.error("[Bildim] soru atlanamadi:", e);
      macYukle();
      throw e; // QuestionCard hatayı görüp kendi kilidini de açsın
    }
  }, [id, macYukle]);

  if (!mac) {
    return (
      <MacYukleniyor
        hata={yuklemeHatasi}
        onTekrarDene={() => { setYuklemeHatasi(null); macYukle(); }}
      />
    );
  }

  const benP1 = mac.oyuncu1 === user.id;
  const toplamSoru = mac.soru_ids?.length ?? 5;
  const benimSkor = benP1 ? mac.oyuncu1_skor : mac.oyuncu2_skor;
  const rakipSkor = benP1 ? mac.oyuncu2_skor : mac.oyuncu1_skor;
  const rakipProfil = benP1 ? mac.p2 : mac.p1;
  const rakipBot = Boolean(rakipProfil?.is_bot);
  const benimProfil = benP1 ? mac.p1 : mac.p2;

  if (mac.durum === "bekliyor") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji"><Ikon ad="saat" boyut={44} /></div>
        <h2>Cevap bekleniyor</h2>
        <p className="alt-yazi">{rakipProfil?.gorunen_ad} henüz kabul etmedi.</p>
      </div>
    );
  }

  // Senkron kapısı: HERKES "Hazır"a basana kadar soru gösterilmez.
  // Rakip ekranda olsa bile onay vermeden maç başlamaz (kullanıcı isteği).
  if (senkronBekliyor) {
    return (
      <HazirKapisi
        benHazir={Boolean(nabiz?.ben_hazir)}
        hazirSayisi={(nabiz?.ben_hazir ? 1 : 0) + (nabiz?.rakip_hazir ? 1 : 0)}
        toplamOyuncu={2}
        bekleyenAdlar={
          nabiz && !nabiz.rakip_hazir && rakipProfil?.gorunen_ad
            ? [rakipProfil.gorunen_ad]
            : []
        }
        onHazir={hazirla}
        // Henüz tek cevap yok: mac_iptal puansız iptal eder ve rakibe haber
        // verir. Maçı ortada asılı bırakmaktan iyisi bu.
        onCik={maciIptalEt}
        // Bot maçında asenkron seçeneği anlamsız (bot zaten hep hazır).
        onAsenkron={rakipBot ? null : asenkronaGec}
        bekleyenSn={nabiz?.lobi_saniye ?? 0}
        tabela={
          <div className="skor-tabela bd-vs" style={{ maxWidth: 360, margin: "0 auto 16px" }}>
            <div className="taraf bd-vs-taraf">
              <Avatar profile={benimProfil} boyut={44} />
              <div className="isim">{benimProfil?.gorunen_ad}<SenRozeti /></div>
              <div className="bd-vs-ilerleme">{nabiz?.ben_hazir ? "hazır" : "bekleniyor…"}</div>
            </div>
            <div className="vs bd-vs-rozet">VS</div>
            <div className="taraf bd-vs-taraf">
              <Avatar profile={rakipProfil} boyut={44} />
              <div className="isim">{rakipProfil?.gorunen_ad}</div>
              <div className="bd-vs-ilerleme">
                {nabiz?.rakip_hazir ? "hazır" : nabiz?.rakip_baglantili ? "ekranda" : "bekleniyor…"}
              </div>
            </div>
          </div>
        }
      />
    );
  }

  if (mac.durum === "reddedildi" || mac.durum === "iptal") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji"><Ikon ad="carpi" boyut={40} /></div>
        <h2>Meydan okuma reddedildi</h2>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate(y("/meydan"))}>
          Geri dön
        </button>
      </div>
    );
  }

  if (mac.durum === "bitti" && sonucHazir && !gecisBitti) {
    return (
      <SureDolduGecis
        baslik="Maç bitti!"
        skor={mac.oyuncu1 === user.id ? mac.oyuncu1_skor : mac.oyuncu2_skor}
        skorEtiket="puan"
        kazandi={mac.kazanan === user.id}
        kaybetti={mac.kazanan !== null && mac.kazanan !== user.id}
        onBitti={() => setGecisBitti(true)}
      />
    );
  }

  if (mac.durum === "bitti" && sonucHazir) {
    const kazandim = mac.kazanan === user.id;
    const berabere = mac.kazanan === null;
    const durumSinifi = kazandim ? "kazandi" : berabere ? "berabere" : "kaybetti";
    return (
      /* bd-sonuc-ekran + durum sınıfı: kazanmada altın parıltı, kaybetmede
         sönük mercan, berabere nötr (bkz. tema.css FAZ 4). */
      <div className={`buyuk-mesaj bd-sonuc-ekran ${durumSinifi}`}>
        <Maskot
          poz={kazandim ? "kutluyor" : berabere ? "selam" : "dusunuyor"}
          boyut={110}
          className="bd-sonuc-maskot"
        />
        <h2 className={`bd-sonuc-baslik ${kazandim ? "kazandi" : berabere ? "" : "kaybetti"}`}>
          {berabere ? "Berabere!" : kazandim ? "Kazandın!" : "Kaybettin"}
        </h2>
        {mac.terk_eden && (
          <p className="alt-yazi" style={{ marginTop: -4 }}>
            {mac.terk_eden === user.id
              ? "Maçtan ayrıldığın için hükmen mağlup sayıldın."
              : `${rakipProfil?.gorunen_ad} maçı terk etti — hükmen kazandın.`}
          </p>
        )}
        {kazandim && <span className="bd-sonuc-kazanc">+20 puan</span>}
        <div className="skor-tabela" style={{ marginTop: 20 }}>
          <div className="taraf">
            <div className="isim">{benimProfil?.gorunen_ad}<SenRozeti /></div>
            <div className="skor"><SayanSayi deger={benimSkor} /></div>
            <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
          </div>
          <div className="vs">VS</div>
          <div className="taraf">
            <div className="isim">{rakipProfil?.gorunen_ad}</div>
            <div className="skor"><SayanSayi deger={rakipSkor} /></div>
            <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
          </div>
        </div>
        <MacSonuDokum macId={id} kazanilanPuan={kazandim ? 20 : 0} />
        <MacSonuEklentisi
          macTur="1v1"
          macId={id}
          kaybettim={!kazandim && !berabere}
          rakipBot={rakipBot}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "20px auto 0" }}>
          {/* TEK rövanş butonu. Bot rakipte doğrudan yeni maç kurulur; gerçek
              oyuncuda istek gönderilir ve o buton MacSonuEklentisi'nde çizilir
              (zorla maça sokulamaz). İkisi aynı anda ASLA görünmez. */}
          {rakipBot && (
            <button
              className="btn bd-rovans-tek"
              onClick={async () => {
                const { data, error } = await supabase.rpc("create_challenge", {
                  p_rakip: rakipProfil.id,
                  p_kategori: mac.kategori,
                });
                if (!error && data) navigate(y(`/mac/${data}`));
                else navigate(y("/meydan"));
              }}
            >
              Rövanş
            </button>
          )}
          {(() => {
            const sonucYazi = berabere
              ? `${rakipProfil?.gorunen_ad} ile ${benimSkor}-${rakipSkor} berabere kaldım`
              : kazandim
                ? `${rakipProfil?.gorunen_ad}'i ${benimSkor}-${rakipSkor} yendim!`
                : `${rakipProfil?.gorunen_ad} karşısında kıl payı kaybettim`;
            const mesaj = `Quiz Square'de ${sonucYazi} Sen de gel, kapışalım: ${window.location.origin}/?davet=${user.id}`;
            const enc = encodeURIComponent(mesaj);
            return (
              <div className="paylas-bar">
                <a
                  className="paylas wa"
                  href={`https://wa.me/?text=${enc}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="paylas x"
                  href={`https://twitter.com/intent/tweet?text=${enc}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  𝕏 Paylaş
                </a>
                <button
                  className="paylas diger"
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: "Quiz Square", text: mesaj });
                      } catch { /* vazgeçti */ }
                    } else {
                      await navigator.clipboard.writeText(mesaj);
                    }
                  }}
                >
                  Diğer
                </button>
              </div>
            );
          })()}
          {/* Bildirim izni ilk açılışta değil, ilk maç sonucunda sorulur. */}
          <BildirimIzniSor />
          <button className="btn ikincil" onClick={() => navigate(y("/meydan"))}>
            Meydan okumalara dön
          </button>
        </div>

        {/* MAÇ BİTTİ AMA OTURUM KAPANMAZ.
            Sayfa kendiliğinden kapanmıyor; oyuncular isterlerse burada kalıp
            konuşmaya devam eder, çıkmaya kendileri karar verir. Sohbet ve
            sesli sohbet bu yüzden sonuç ekranında da duruyor. */}
        <div className="bd-oturum-notu">
          Maç bitti ama oturum açık: istersen burada kalıp
          {rakipBot ? " sohbet edebilirsin" : ` ${rakipProfil?.gorunen_ad} ile konuşmaya devam edebilirsin`}.
          Çıkmak sana kalmış.
        </div>

        <SesliSohbet macId={id} benimId={user.id} />

        {(balonlar[user.id] || balonlar[rakipProfil?.id]) && (
          <div className="balon-satir">
            <div className="balon-yuva">
              {balonlar[user.id] && (
                <div className="balon">{balonIcerik(balonlar[user.id])}</div>
              )}
            </div>
            <div className="balon-yuva sag">
              {balonlar[rakipProfil?.id] && (
                <div className="balon rakip">{balonIcerik(balonlar[rakipProfil?.id])}</div>
              )}
            </div>
          </div>
        )}

        <div className="sohbet-bar">
          {TEPKILER.map((t) => (
            <button
              key={t.deger}
              onClick={() => mesajGonder(t.deger)}
              aria-label={t.etiket}
              title={t.etiket}
            >
              <Ikon ad={t.ad} boyut={18} />
            </button>
          ))}
          <button
            className={kaliplarAcik ? "acik" : ""}
            onClick={() => setKaliplarAcik((a) => !a)}
          >
            <Ikon ad="sohbet" boyut={18} />
          </button>
        </div>
        {kaliplarAcik && (
          <div className="kalip-liste">
            {KALIPLAR.map((k) => (
              <button key={k} onClick={() => mesajGonder(k)}>
                {k}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Asenkron maç: kendi bölümümüz bitti ama rakip henüz oynamadı.
  // Maç burada kapanmaz — rakip kendi zamanında oynayınca sonuçlanır.
  const benimSoru = benP1 ? (mac.oyuncu1_soru ?? 0) : (mac.oyuncu2_soru ?? 0);
  // Son 3 soru: tabelanın kenarlığı altına döner
  const sonDuzluk = toplamSoru - benimSoru <= 3;
  // Bu ekran YALNIZ eski asenkron maçlara ait: senkron maçta iki taraf aynı
  // anda bitirir, maç da o anda sonuçlanır.
  if (!senkron && mac.durum === "aktif" && benimSoru >= toplamSoru) {
    return (
      <div className="buyuk-mesaj">
        <Maskot poz="selam" boyut={104} className="bd-sonuc-maskot" />
        <h2>Senin bölümün bitti</h2>
        <p className="alt-yazi" style={{ marginBottom: 14 }}>
          {toplamSoru} sorunun tamamını oynadın. <b>{rakipProfil?.gorunen_ad}</b> kendi
          zamanında oynayınca maç sonuçlanacak — bittiğinde sana haber vereceğiz.
        </p>
        <div className="skor-tabela bd-vs" style={{ maxWidth: 360, margin: "0 auto 16px" }}>
          <div className="taraf bd-vs-taraf">
            <div className="isim">{benimProfil?.gorunen_ad}<SenRozeti /></div>
            <div className="skor"><SayanSayi deger={benimSkor} /></div>
            <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
          </div>
          <div className="vs bd-vs-rozet">VS</div>
          <div className="taraf bd-vs-taraf">
            <div className="isim">{rakipProfil?.gorunen_ad}</div>
            <div className="skor"><SayanSayi deger={rakipSkor} /></div>
            <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
          </div>
        </div>
        <button className="btn" onClick={() => navigate(y("/meydan"))}>
          Yeni maça başla
        </button>
      </div>
    );
  }

  // Aktif maç
  // İlk render'da bir kez karar ver: rakip öndeyse bilgi kartını göster.
  // Senkron maçta kimse öne geçemez; bu kart yalnız eski maçlarda anlamlı.
  if (ilkGirisRef.current === null) {
    ilkGirisRef.current = !senkron && ilerleme.rakip > ilerleme.ben && benimSoru === 0;
  }
  const rakipOnde = ilkGirisRef.current;

  return (
    <div>
      {/* 3-2-1: iki oyuncuda da AYNI ANDA biter, ilk soru gecikmesiz açılır. */}
      {geriSayim !== null && <GeriSayim kalan={geriSayim} />}

      {/* Rakip oyundan çıktı / ekran değiştirdi: ekran kilitlenir, maç durur.
          Süre işlemediği için burada bekleyen oyuncu bir şey kaybetmez. */}
      {duraklatildi && (
        <KopukPerde
          bekleyenAdlar={rakipProfil?.gorunen_ad ? [rakipProfil.gorunen_ad] : []}
          gecenSn={duraklamaSn}
        />
      )}

      {/* Maç ekranında alt menü gizli; çıkış sol üstte */}
      <button
        className="bd-mac-cikis"
        aria-label="Maçtan çık"
        onClick={() => navigate(y("/meydan"))}
      >
        <Ikon ad="carpi" boyut={18} />
      </button>

      {rakipOnde && !bilgiKapandi && (
        <div className="bd-mac-bilgi">
          <span className="ikon" aria-hidden="true">
            <Ikon ad="saat" boyut={18} />
          </span>
          <span style={{ flex: 1 }}>
            <b>{rakipProfil?.gorunen_ad}</b> senden önde. Bu maç sıra
            beklemeden oynanır — sen kendi hızında devam et, rakibin de kendi
            zamanında oynar.
          </span>
          <button
            className="btn kucuk ikincil"
            aria-label="Kapat"
            onClick={() => setBilgiKapandi(true)}
          >
            <Ikon ad="carpi" boyut={16} />
          </button>
        </div>
      )}

      {/* Üst tabela: kim önde belli olsun. Önde olan hafif büyük ve
          kenarlıklı, geride olan sönük. Son 3 soruda tabelanın kenarlığı
          altına döner ("maç kızışıyor"). */}
      <div className={`skor-tabela bd-vs ${sonDuzluk ? "bd-vs-kizisti" : ""}`}>
        <div
          className={`taraf bd-vs-taraf ${
            benimSkor > rakipSkor ? "onde" : benimSkor < rakipSkor ? "geride" : ""
          }`}
        >
          <AvatarCerceve profile={benimProfil} boyut={44} userId={user.id} />
          <div className="isim">{benimProfil?.gorunen_ad}<SenRozeti /></div>
          <div className="skor"><SayanSayi deger={benimSkor} /></div>
          <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
        </div>
        {/* Senkronda ortak soru numarası; eski maçlarda KENDİ sıramız */}
        <div className="vs bd-vs-rozet">
          {Math.min((senkron ? kendiIndeks : benimSoru) + 1, toplamSoru)}/{toplamSoru}
        </div>
        <div
          className={`taraf bd-vs-taraf ${
            rakipSkor > benimSkor ? "onde" : rakipSkor < benimSkor ? "geride" : ""
          } ${rakipNabiz ? "bd-nabiz" : ""}`}
        >
          <AvatarCerceve profile={rakipProfil} boyut={44} userId={benP1 ? mac.oyuncu2 : mac.oyuncu1} />
          <div className="isim">{rakipProfil?.gorunen_ad}</div>
          <div className="skor"><SayanSayi deger={rakipSkor} /></div>
          <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
        </div>
      </div>

      {(balonlar[user.id] || balonlar[rakipProfil?.id]) && (
        <div className="balon-satir">
          <div className="balon-yuva">
            {balonlar[user.id] && (
              <div className="balon">{balonIcerik(balonlar[user.id])}</div>
            )}
          </div>
          <div className="balon-yuva sag">
            {balonlar[rakipProfil?.id] && (
              <div className="balon rakip">{balonIcerik(balonlar[rakipProfil?.id])}</div>
            )}
          </div>
        </div>
      )}

      {jokerHata && <div className="hata-kutu">{jokerHata}</div>}

      {soru && (
        <QuestionCard
          // KENDİ indeksimize bağlanır — `aktif_soru`ya DEĞİL.
          //
          // `aktif_soru` iki oyuncudan hangisi ileriyse onu gösteren ORTAK
          // sayaç (senkron dönemden kalma). Asenkron 1v1'de rakip cevap
          // verdiğinde de artıyor; key ona bağlıyken rakibin her cevabı bu
          // kartı komple yeniden bindiriyordu: seçili şık, süre sayacı ve
          // sonuç ekranı sıfırlanıyor, oyuncu "sayfa yenilendi, şıkkı yeniden
          // işaretledim" diyordu. Sesli sohbette iki taraf aynı anda oynadığı
          // için sorun orada sürekli görülüyordu.
          //
          // Soruyu çeken effect de `kendiIndeks`e bağlı (yukarıda); key artık
          // onunla aynı kaynağa bakıyor. Grup ve Hızlı maç GERÇEKTEN senkron
          // olduğu için oralarda `aktif_soru` doğrudur, dokunulmadı.
          key={`${mac.id}-${kendiIndeks}-${duraklamaTuru}`}
          soru={soru}
          onCevapla={cevapla}
          onSureDoldu={sureDoldu}
          macTur={"1v1"}
          macId={id}
          kategori={mac.kategori}
        />
      )}

      {cevapladim && (
        <div className="alt-yazi" style={{ textAlign: "center", marginTop: 14 }}>
          {senkron
            ? `${rakipProfil?.gorunen_ad} cevaplayınca soru geçecek…`
            : "Sıradaki soru geliyor…"}
        </div>
      )}

      {/* Sesli sohbet yazılı sohbetin ÜSTÜNDE: yalnız arkadaş olan iki oyuncu
          aynı anda maçtayken çizilir, aksi halde hiç görünmez. */}
      <SesliSohbet macId={id} benimId={user.id} />

      <div className="sohbet-bar">
        {TEPKILER.map((t) => (
          <button
            key={t.deger}
            onClick={() => mesajGonder(t.deger)}
            aria-label={t.etiket}
            title={t.etiket}
          >
            <Ikon ad={t.ad} boyut={18} />
          </button>
        ))}
        <button
          className={kaliplarAcik ? "acik" : ""}
          onClick={() => setKaliplarAcik((a) => !a)}
        >
          <Ikon ad="sohbet" boyut={18} />
        </button>
      </div>
      {kaliplarAcik && (
        <div className="kalip-liste">
          {KALIPLAR.map((k) => (
            <button key={k} onClick={() => mesajGonder(k)}>
              {k}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
