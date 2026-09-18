// ============================================================
// DÜELLO (TAKTİK MAÇI) — Paket 14, aşama 4
//
// Kurallar ve süreler SUNUCUDA (migration 205). Bu sayfa yalnız
// duello_durum()'un oyuncuya süzülmüş görünümünü çizer ve eylemleri iletir.
// Canlılık: duello_sinyal (Realtime, yalnız sürüm) + 1 sn'lik yoklama.
//
// Gizlilik: rakibin bot olup olmadığı istemciye hiç gelmez; bu sayfada
// "bot" kelimesi geçmez. Rakibin şıklar arasında gezinmesi gösterilmez —
// yalnız kilitlediği cevap sonuç fazında açıklanır.
//
// iOS: son can koyulaşması sayfa kabının ::before katmanıyla yapılır
// (position:fixed + transform aynı öğede YOK).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import Ikon from "../components/Ikon.jsx";
import KategoriIkon from "../components/KategoriIkon.jsx";
import Maskot from "../components/Maskot.jsx";
import BildirimIzniSor from "../components/BildirimIzniSor.jsx";
import OdulDokumu from "../components/OdulDokumu.jsx";
import DuelloOzet from "../components/DuelloOzet.jsx";
import DuelloTanitim, { duelloTanitimGoruldu } from "../components/DuelloTanitim.jsx";
import HesapGuvenceOnerisi from "../components/HesapGuvence.jsx";
import DereceliAnahtari from "../components/DereceliAnahtari.jsx";
import JokerSatinAlModal from "../components/JokerSatinAlModal.jsx";
import { useDereceliTercih } from "../lib/dereceli.js";
import { useDil } from "../lib/dilKanca.js";
import { hataMesaji } from "../lib/hata.js";
import { kategoriAdi } from "../lib/kategoriler.js";
import { unvanAdi } from "../lib/unvanlar.js";
import { JOKER_BILGI, SALDIRI_JOKERLERI, MAC_ICI_JOKERLER } from "../lib/jokerler.js";
import { y } from "../lib/yol.js";
import { coinTazele } from "../lib/coin.js";
import { sesKilidiAc, sesTik, sesDogru, sesYanlis, sesJoker, sesKazandin, sesKaybettin, sesDokunus } from "../lib/ses.js";
import { titret } from "../lib/geriBildirim.js";
import { tt } from "../lib/dil.js";

const HARFLER = ["A", "B", "C", "D"];

// Savunma jokerlerinin Düello'daki adları (Ek Süre +5 sn; sunucu ayarı duello_ek_sure_sn)
const SAVUNMA_AD = { elli: "50:50", sure: tt("Ek Süre"), soru_degistir: tt("Soru Değiştir") };
const SAVUNMA_ACIKLAMA = {
  elli: tt("İki yanlış şık silinir"),
  sure: tt("Cevap süresine 5 saniye ekler"),
  soru_degistir: tt("Aynı kategoriden başka soru gelir"),
};
const SALDIRI_AD = { zaman_baskisi: tt("Zaman Baskısı"), saldiri_degistir: tt("Soru Değiştir"), savunma_kilidi: tt("Savunma Kilidi") };

function Kalpler({ can, max = 3, sonCan }) {
  return (
    <span className={`bd-duello-kalpler ${sonCan ? "son" : ""}`} aria-label={`${can}`}>
      {Array.from({ length: Math.max(max, can) }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
             className={i < can ? "dolu" : "bos"}>
          <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z" />
        </svg>
      ))}
    </span>
  );
}

// ------------------------------------------------------------ giriş + arama
function DuelloGiris() {
  const navigate = useNavigate();
  const { ceviri } = useDil();
  const [dereceli, setDereceli] = useDereceliTercih();
  const [arama, setArama] = useState(false);
  const [tanitim, setTanitim] = useState(null);   // null | "arama" (bitince aramaya geç) | "kurallar"

  return (
    <div className="bd-duello-giris">
      <h1 className="baslik">{ceviri("Düello")}</h1>
      <div className="kart bd-duello-tanit">
        <Maskot poz="selam" boyut={72} />
        <div className="bd-duello-tanit-metin">
          <b>{ceviri("Taktik Maçı")}</b>
          <p>{ceviri("Sırayla birbirinize soru gönderin. Rakibin zayıf kategorisini bul, oradan vur.")}</p>
          <ul>
            <li>{ceviri("3 can, en çok 10 tur")}</li>
            <li>{ceviri("Rakip en zayıf kategorisinde bilirse canı SEN kaybedersin")}</li>
            <li>{ceviri("Aynı kategori üst üste seçilemez, maçta en çok 2 kez")}</li>
          </ul>
        </div>
      </div>
      <DereceliAnahtari dereceli={dereceli} onDegistir={setDereceli} />
      <div className="bd-ana-eylem-not">
        {dereceli ? ceviri("Galibiyet: +50 lig puanı ve 50 coin") : ceviri("Serbest: lig puanı yok, coin yarı.")}
      </div>
      <button className="bd-ana-eylem" onClick={() => { sesKilidiAc(); if (duelloTanitimGoruldu()) setArama(true); else setTanitim("arama"); }}>
        <Ikon ad="kilic" boyut={22} />
        <span>{ceviri("Rakip ara")}</span>
      </button>
      {/* Paket 20 IV.1: kurallar her zaman yeniden açılabilir */}
      <button type="button" className="bd-bildir-ac bd-duello-kurallar" onClick={() => setTanitim("kurallar")}>{ceviri("Kurallar nasıl işliyor?")}</button>
      {tanitim && <DuelloTanitim onKapat={() => { const aramaya = tanitim === "arama"; setTanitim(null); if (aramaya) setArama(true); }} />}
      {arama && (
        <DuelloArama
          dereceli={dereceli}
          onBulundu={(id) => navigate(y(`/duello/${id}`))}
          onIptal={() => setArama(false)}
        />
      )}
    </div>
  );
}

function DuelloArama({ dereceli, onBulundu, onIptal }) {
  const { ceviri } = useDil();
  const [gecen, setGecen] = useState(0);
  const [hata, setHata] = useState(null);
  const bittiRef = useRef(false);
  const bulunduRef = useRef(onBulundu);
  bulunduRef.current = onBulundu;

  useEffect(() => {
    let iptal = false;
    const dene = async () => {
      if (iptal || bittiRef.current) return;
      try {
        const { data, error } = await supabase.rpc("duello_ara", { p_dereceli: dereceli });
        if (error) throw error;
        if (data && !bittiRef.current) {
          bittiRef.current = true;
          bulunduRef.current(data);
        }
      } catch (e) {
        setHata(ceviri(hataMesaji(e, "Rakip aranamadı. Bağlantını kontrol edip tekrar dene.")));
        bittiRef.current = true;
      }
    };
    dene();
    const zaman = setInterval(() => { setGecen((g) => g + 1); dene(); }, 1000);
    return () => {
      iptal = true;
      clearInterval(zaman);
      if (!bittiRef.current) supabase.rpc("duello_aramadan_cik").then(() => {}, () => {});
    };
  }, [dereceli, ceviri]);

  return createPortal(
    <div className="bd-arama-katman" role="dialog" aria-modal="true" aria-label={ceviri("Rakip aranıyor")}>
      <div className="bd-arama-kutu">
        <div className="bd-arama-halka" aria-hidden="true"><Maskot poz="dusunuyor" boyut={84} /></div>
        <div className="bd-arama-baslik">{ceviri("Düello rakibi aranıyor…")}</div>
        <div className="alt-yazi">{gecen} {tt("sn")}</div>
        {hata && <div className="hata-kutu">{hata}</div>}
        <button className="btn ikincil" onClick={onIptal}>{ceviri("Vazgeç")}</button>
      </div>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------ maç
function DuelloMac({ id }) {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { ceviri } = useDil();
  const [d, setD] = useState(null);
  const [hata, setHata] = useState(null);
  const [yuklemeHatasi, setYuklemeHatasi] = useState(null);
  const [baglanti, setBaglanti] = useState(null);   // Paket 24 · A.4: rakip kopuk mu
  const [simdi, setSimdi] = useState(Date.now());
  const [secim, setSecim] = useState(null);
  const [calisan, setCalisan] = useState(null);
  const [terkOnay, setTerkOnay] = useState(false);
  // Paket 27 C: maç içinde satın alınacak joker türü (null = pencere kapalı)
  // Paket 28 D: { tur, yalnizAl }. `yalnizAl` kategori ekranında true —
  // joker envantere girer, kullanımı Saldırı Hazırlığı'nda yapılır.
  const [satinAlinacak, setSatinAlinacak] = useState(null);
  const [dokumToplam, setDokumToplam] = useState(null);   // Paket 20 I.3: sunucu dökümünün toplamı
  const farkRef = useRef(0); // sunucu saati - istemci saati (ms)
  const yukleniyorRef = useRef(false);
  const sonHamleRef = useRef(null);
  const bitisSesRef = useRef(false);
  const sonTikRef = useRef(null);
  const haleSureRef = useRef({ anahtar: "", sn: 0 });   // savunma halesi: fazın toplam süresi (ek süreyle büyür)

  const yukle = useCallback(async () => {
    if (yukleniyorRef.current) return;
    yukleniyorRef.current = true;
    try {
      // Paket 24 · A.4: bağlantı durumu AYNI ANDA sorulur — ek gecikme olmaz.
      // duello_durum 150 satırlık bir fonksiyon; onu genişletmek yerine ayrı, ucuz çağrı.
      const [durumCevap, baglantiCevap] = await Promise.all([
        supabase.rpc("duello_durum", { p_id: id }),
        supabase.rpc("duello_baglanti", { p_id: id }),
      ]);
      const { data, error } = durumCevap;
      if (error) throw error;
      if (data) {
        farkRef.current = new Date(data.sunucu_zamani).getTime() - Date.now();
        setD(data);
        setYuklemeHatasi(null);
      }
      if (baglantiCevap?.error) {
        console.warn("[Bildim] duello_baglanti başarısız:", baglantiCevap.error.message);
      } else {
        setBaglanti(baglantiCevap?.data ?? null);
      }
    } catch (e) {
      setYuklemeHatasi(ceviri(hataMesaji(e, "Düello yüklenemedi.")));
    } finally {
      yukleniyorRef.current = false;
    }
  }, [id, ceviri]);

  // İlk yükleme + Realtime sinyali + yoklama
  useEffect(() => {
    sesKilidiAc();
    yukle();
    const kanal = supabase
      .channel(`duello-${id}`)
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "duello_sinyal", filter: `duello_id=eq.${id}` },
          () => yukle())
      .subscribe();
    const yoklama = setInterval(() => {
      if (document.visibilityState === "visible") yukle();
    }, 1000);
    const saat = setInterval(() => setSimdi(Date.now()), 200);
    return () => {
      clearInterval(yoklama);
      clearInterval(saat);
      supabase.removeChannel(kanal);
    };
  }, [id, yukle]);

  // ---------------- Paket 28 A: düellonun kendi nabzı ----------------
  //
  // KUSUR: paylaşılan kabuk (AuthContext) `kalp_at()`i 60 SANİYEDE BİR atıyor,
  // düellonun kopukluk eşiği ise 25 saniye. 60 > 25 olduğu için iki nabız
  // arasında 35 saniyelik bir pencere vardı ve o pencerede TAMAMEN BAĞLI bir
  // oyuncu "kopuk" sayılıyordu — düello açılır açılmaz turuncu "Bağlantın
  // koptu" bandı çıkıyordu. Üstelik 45 sn'lik bekleme dolarsa bağlı oyuncu
  // maçı HAKSIZ YERE kaybedebilirdi.
  //
  // KURAL: nabız aralığı kopukluk eşiğinin yarısından küçük olmalı. Bu ilişkiyi
  // istemci değil SUNUCU garantiliyor: `duello_durum().sureler.nabiz` değeri
  // `duello_nabiz_sn()` ile her zaman eşiğin yarısına kırpılıyor. Buradaki 10
  // yalnız sunucu henüz cevap vermemişken kullanılan ilk değer.
  const nabizSn = Number(d?.sureler?.nabiz) > 0 ? Number(d.sureler.nabiz) : 10;
  useEffect(() => {
    if (!id) return undefined;
    let durdu = false;
    const at = async () => {
      if (durdu || document.visibilityState !== "visible") return;
      try {
        await supabase.rpc("kalp_at");
      } catch (e) {
        // Ağ dalgalanması: bir sonraki nabız zaten deneyecek.
        console.warn("[Bildim] düello nabzı atılamadı:", e?.message ?? e);
      }
    };
    at();                                   // ekran açılır açılmaz bir kez
    const zaman = setInterval(at, nabizSn * 1000);
    document.addEventListener("visibilitychange", at);
    return () => {
      durdu = true;
      clearInterval(zaman);
      document.removeEventListener("visibilitychange", at);
    };
  }, [id, nabizSn]);

  // Faz değişince yerel seçim sıfırlanır
  const fazAnahtari = d ? `${d.tur}-${d.saldiri_sirasi}-${d.faz}-${d.soru?.soru ?? ""}` : "";
  useEffect(() => { setSecim(null); setHata(null); }, [fazAnahtari]);

  // Hamle sonucu sesi
  useEffect(() => {
    const h = d?.son_hamle;
    if (!h || d.faz !== "sonuc") return;
    const anahtar = `${h.tur}-${h.saldiran}-${h.soru_id}`;
    if (sonHamleRef.current === anahtar) return;
    sonHamleRef.current = anahtar;
    const benKaybettim = h.can_kaybeden === d.ben;
    if (benKaybettim) { sesYanlis(); titret(40); } else { sesDogru(); titret(10); }
  }, [d]);

  // Maç sonu sesi + coin/profil tazeleme
  useEffect(() => {
    if (!d || d.durum !== "bitti" || bitisSesRef.current) return;
    bitisSesRef.current = true;
    if (d.kazanan === d.ben) sesKazandin(); else sesKaybettin();
    coinTazele();
    refreshProfile?.(user?.id);
  }, [d, refreshProfile, user?.id]);

  // Rövanş kabul edildiyse iki taraf da yeni düelloya geçer
  useEffect(() => {
    if (d?.rovans?.id && d.rovans.id !== id) navigate(y(`/duello/${d.rovans.id}`), { replace: true });
  }, [d?.rovans?.id, id, navigate]);

  const kalanSn = useMemo(() => {
    if (!d?.faz_bitis) return 0;
    return Math.max(0, (new Date(d.faz_bitis).getTime() - (simdi + farkRef.current)) / 1000);
  }, [d?.faz_bitis, simdi]);

  // Son 3 saniyede tik
  useEffect(() => {
    if (!d || !["cevap", "altin"].includes(d.faz)) return;
    const sn = Math.ceil(kalanSn);
    if (sn > 0 && sn <= 3 && sonTikRef.current !== sn) { sonTikRef.current = sn; sesTik(sn); }
  }, [kalanSn, d]);

  const eylem = async (ad, fn, params) => {
    setHata(null);
    setCalisan(ad);
    try {
      const { error } = await supabase.rpc(fn, { p_id: id, ...params });
      if (error) throw error;
      await yukle();
      return true;
    } catch (e) {
      setHata(ceviri(hataMesaji(e)));
      return false;
    } finally {
      setCalisan(null);
    }
  };

  if (!d) {
    return (
      <div className="bd-duello">
        {yuklemeHatasi ? (
          <div className="kart">
            <div className="hata-kutu">{yuklemeHatasi}</div>
            <button className="btn" onClick={() => navigate(y("/duello"))}>{ceviri("Düello'ya dön")}</button>
          </div>
        ) : (
          <div className="bd-duello-yukleniyor"><Maskot poz="dusunuyor" boyut={80} /></div>
        )}
      </div>
    );
  }

  const ben = d.oyuncular.find((o) => o.id === d.ben) ?? d.oyuncular[0];
  const rakip = d.oyuncular.find((o) => o.id !== d.ben) ?? d.oyuncular[1];
  const benSaldiran = d.saldiran === d.ben;
  const benSavunan = !benSaldiran;
  const sonCan = d.durum === "aktif" && (ben.can === 1 || rakip.can === 1);
  const kullanim = d.kullanim?.[d.saldiran] ?? { sayim: {}, son: null };
  const savunanOyuncu = d.oyuncular.find((o) => o.id === d.savunan);
  const secenekler = d.soru ? (Array.isArray(d.soru.secenekler) ? d.soru.secenekler : JSON.parse(d.soru.secenekler)) : [];
  const ezeliMetin = d.ezeli
    ? d.ezeli.ben > d.ezeli.rakip
      ? ceviri("Bu oyuncuyla {ben}-{rakip} öndesin", d.ezeli)
      : d.ezeli.ben < d.ezeli.rakip
        ? ceviri("Bu oyuncuyla {ben}-{rakip} geridesin", d.ezeli)
        : ceviri("Bu oyuncuyla {ben}-{rakip} berabersiniz", d.ezeli)
    : null;

  // ---------------- sonuç ekranı ----------------
  if (d.durum !== "aktif") {
    const kazandim = d.kazanan === d.ben;
    const rov = d.rovans ?? {};
    return (
      <div className="bd-duello">
        <div className={`buyuk-mesaj bd-sonuc-ekran ${d.durum === "iptal" ? "berabere" : kazandim ? "kazandi" : "kaybetti"}`}>
          <Maskot poz={kazandim ? "kutluyor" : "dusunuyor"} boyut={100} className="bd-sonuc-maskot" />
          <h2 className={`bd-sonuc-baslik ${kazandim ? "kazandi" : "kaybetti"}`}>
            {d.durum === "iptal" ? ceviri("Düello iptal edildi") : kazandim ? ceviri("Kazandın!") : ceviri("Kaybettin")}
          </h2>
          <div className="bd-duello-sonuc-canlar">
            <span>{ben.gorunen_ad}</span> <Kalpler can={Math.max(0, ben.can)} />
            <span className="vs">VS</span>
            <Kalpler can={Math.max(0, rakip.can)} /> <span>{rakip.gorunen_ad}</span>
          </div>
          {(() => {
            const o = dokumToplam ? { lig_puan: dokumToplam.lig, coin: dokumToplam.coin } : d.odul;
            return o && (o.lig_puan > 0 || o.coin > 0) && (
              <div className="bd-kazanc-satiri">
                {o.lig_puan > 0 && <span className="bd-sonuc-kazanc">{ceviri("+{puan} lig puanı", { puan: o.lig_puan })}</span>}
                {o.coin > 0 && <span className="bd-sonuc-kazanc">{ceviri("+{coin} coin", { coin: o.coin })}</span>}
              </div>
            );
          })()}
          {d.durum === "bitti" && <OdulDokumu kaynak={`duello:${d.id}`} onToplam={setDokumToplam} />}
          {d.durum === "bitti" && d.son_hamle?.altin && secenekler.length > 0 && (
            <AltinSonucu h={d.son_hamle} ben={d.ben} soru={d.soru?.soru} secenekler={secenekler} ceviri={ceviri} />
          )}
          {d.durum === "bitti" && <DuelloOzet id={d.id} />}
          {ezeliMetin && <div className="bd-duello-ezeli">{ezeliMetin}</div>}

          <div className="bd-duello-rovans">
            {rov.id ? (
              <button className="btn" onClick={() => navigate(y(`/duello/${rov.id}`))}>{ceviri("Rövanşa git")}</button>
            ) : rov.isteyen && rov.gecerli && rov.isteyen === d.ben ? (
              <div className="alt-yazi">{ceviri("Rövanş isteği gönderildi, rakip bekleniyor…")}</div>
            ) : rov.isteyen && rov.gecerli ? (
              <>
                <div className="bd-duello-rovans-soru">{ceviri("{ad} rövanş istiyor!", { ad: rakip.gorunen_ad })}</div>
                <div className="bd-konum-butonlar">
                  <button className="btn" disabled={!!calisan}
                          onClick={() => eylem("rovans", "duello_rovans_yanitla", { p_kabul: true })}>
                    {ceviri("Kabul et")}
                  </button>
                  <button className="btn ikincil" disabled={!!calisan}
                          onClick={() => eylem("rovans", "duello_rovans_yanitla", { p_kabul: false })}>
                    {ceviri("Reddet")}
                  </button>
                </div>
              </>
            ) : d.durum === "bitti" ? (
              <button className="btn" disabled={!!calisan} onClick={() => eylem("rovans", "duello_rovans_iste", {})}>
                <Ikon ad="yenile" boyut={16} /> {ceviri("Rövanş")}
              </button>
            ) : null}
          </div>
          {hata && <div className="hata-kutu">{hata}</div>}
          <BildirimIzniSor />
          <HesapGuvenceOnerisi kazandim={d.durum === "bitti" && kazandim} />
          <div className="bd-konum-butonlar" style={{ marginTop: 12 }}>
            <button className="btn ikincil" onClick={() => navigate(y("/duello"))}>{ceviri("Yeni düello")}</button>
            <button className="btn ikincil" onClick={() => navigate(y())}>{ceviri("Ana sayfa")}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- oyuncu şeridi ----------------
  const oyuncuKart = (o, taraf) => (
    <div className={`bd-duello-oyuncu ${taraf} ${d.saldiran === o.id ? "saldiriyor" : ""}`}>
      <Avatar profile={o} boyut={44} />
      <div className="bd-duello-oyuncu-bilgi">
        <div className="bd-duello-oyuncu-ad">{o.gorunen_ad}</div>
        {unvanAdi(o.unvan) && <div className="bd-unvan kucuk">{ceviri(unvanAdi(o.unvan))}</div>}
        <Kalpler can={Math.max(0, o.can)} sonCan={o.can === 1} />
      </div>
    </div>
  );

  // ---------------- soru bloğu ----------------
  const soruBlogu = (tiklanabilir) => {
    const h = d.son_hamle;
    const altinMi = d.faz === "altin";
    const sonucMu = d.faz === "sonuc" && h && !h.altin;
    const kapali = d.elli_kapali ?? [];
    const benimAltin = d.altin?.benim_cevabim;
    return (
      <div className="bd-duello-soru">
        <div className="bd-soru-metin bd-soru-giris">{d.soru?.soru}</div>
        <div className="bd-secenekler">
          {secenekler.map((s, i) => {
            if (kapali.includes(i) && !sonucMu) return <div key={i} className="bd-secenek bd-secenek-bos" aria-hidden="true" />;
            let sinif = "bd-secenek";
            if (sonucMu) {
              if (i === h.dogru_cevap) sinif += " dogru";
              else if (i === h.cevap) sinif += " yanlis";
              else sinif += " solgun";
            } else if (altinMi && benimAltin !== undefined && benimAltin !== null) {
              if (i === Number(benimAltin)) sinif += " secili";
            } else if (i === secim) sinif += " secili";
            return (
              <button key={i} className={sinif}
                      disabled={!tiklanabilir || secim !== null || !!calisan}
                      onClick={async () => {
                        sesDokunus(); titret(10);
                        setSecim(i);
                        const ok = await eylem("cevap", "duello_cevap", { p_cevap: i });
                        if (!ok) setSecim(null);
                      }}>
                <span className="bd-harf">{HARFLER[i]}</span>
                <span className="bd-secenek-metin">{s}</span>
                {sonucMu && i === h.dogru_cevap && <Ikon ad="onay" boyut={18} className="bd-secenek-isaret" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const sayac = (buyuk) => (
    <div className={`bd-duello-sayac ${buyuk ? "buyuk" : ""} ${kalanSn <= 3 ? "kritik" : ""}`} role="timer">
      {Math.ceil(kalanSn)}
    </div>
  );

  // ---------------- faz içeriği ----------------
  let sahne = null;
  const katAdi = d.kategori ? ceviri(kategoriAdi(d.kategori)) : "";

  if (d.faz === "kategori") {
    if (benSaldiran) {
      const profil = rakip.profil?.kategoriler ?? [];
      sahne = (
        <div className="bd-duello-kategori">
          <div className="bd-duello-baslik-satir">
            <h2>{ceviri("Saldırı kategorini seç")}</h2>
            {sayac(false)}
          </div>
          <p className="alt-yazi">{ceviri("Rakibinin kategori başarısı. Kırmızı çerçeve: en zayıf kategorisi — bilirse canı sen kaybedersin.")}</p>
          <p className="alt-yazi bd-duello-kural-not">{ceviri("En zayıf kategori maç başında sabitlenir; yüzdeler eşitse biri seçilip kilitlenir. Bu yüzden eşit görünen kategorilerden yalnız biri riskli.")}</p>
          <div className="bd-duello-kat-grid">
            {d.kategoriler.map((k) => {
              const adet = Number(kullanim.sayim?.[k] ?? 0);
              const kullanilamaz = adet >= d.kategori_max || kullanim.son === k;
              const riskli = rakip.zayif === k;
              const p = profil.find((x) => x.kategori === k);
              return (
                <button key={k} type="button"
                        className={`bd-duello-kat ${riskli ? "riskli" : ""}`}
                        disabled={kullanilamaz || !!calisan}
                        aria-label={`${kategoriAdi(k)} ${adet}/${d.kategori_max}${riskli ? " " + ceviri("riskli") : ""}`}
                        onClick={() => { sesDokunus(); eylem("kategori", "duello_kategori_sec", { p_kategori: k }); }}>
                  <KategoriIkon anahtar={k} boyut={22} plaka />
                  <span className="bd-duello-kat-ad">{ceviri(kategoriAdi(k))}</span>
                  <span className="bd-duello-kat-yuzde">
                    {p?.yuzde === null || p?.yuzde === undefined ? ceviri("veri yok") : `%${p.yuzde}`}
                  </span>
                  <span className="bd-duello-kat-sayac">{adet}/{d.kategori_max}</span>
                  {riskli && <span className="bd-duello-riskli">{ceviri("riskli")}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    } else {
      sahne = (
        <div className="bd-duello-bekle">
          <Maskot poz="dusunuyor" boyut={72} />
          <h2>{ceviri("{ad} saldırı kategorisini seçiyor…", { ad: rakip.gorunen_ad })}</h2>
          {sayac(false)}
          {d.son_hamle && !d.son_hamle.altin && <SonHamleOzet h={d.son_hamle} ben={d.ben} ceviri={ceviri} />}
        </div>
      );
    }
  } else if (d.faz === "hazirlik") {
    sahne = benSaldiran ? (
      <div className="bd-duello-hazirlik">
        <div className="bd-duello-baslik-satir">
          <h2>{ceviri("Saldırı Hazırlığı")} · {katAdi}</h2>
          {sayac(false)}
        </div>
        <p className="alt-yazi">{ceviri("Soruyu gör, istersen saldırı jokeri kullan. Süre dolunca soru rakibe gider.")}</p>
        {soruBlogu(false)}
      </div>
    ) : (
      <div className="bd-duello-bekle">
        <KategoriIkon anahtar={d.kategori} boyut={48} plaka />
        <h2>{ceviri("{kategori} saldırısı geliyor!", { kategori: katAdi })}</h2>
        {sayac(false)}
      </div>
    );
  } else if (d.faz === "cevap") {
    sahne = (
      <div className="bd-duello-cevap">
        <div className="bd-duello-baslik-satir">
          <h2>{benSavunan ? ceviri("Savun!") : ceviri("{ad} düşünüyor…", { ad: rakip.gorunen_ad })} · {katAdi}</h2>
          {sayac(sonCan)}
        </div>
        {d.zaman_baskisi && <div className="bd-duello-bant baski">{ceviri("Zaman Baskısı: cevap süresi 10 saniye")}</div>}
        {d.savunma_kilidi && <div className="bd-duello-bant kilit">{ceviri("Rakip bu soruda savunma jokeri kullanamaz")}</div>}
        {benSavunan && savunanOyuncu?.zayif === d.kategori && (
          <div className="bd-duello-bant firsat">{ceviri("En zayıf kategorin! Bilirsen saldıran can kaybeder.")}</div>
        )}
        {soruBlogu(benSavunan)}
      </div>
    );
  } else if (d.faz === "sonuc") {
    const h = d.son_hamle;
    sahne = (
      <div className="bd-duello-sonuc">
        {h && <SonHamleOzet h={h} ben={d.ben} ceviri={ceviri} buyuk secenekler={secenekler} />}
        {soruBlogu(false)}
      </div>
    );
  } else if (d.faz === "altin") {
    sahne = (
      <div className="bd-duello-altin">
        <div className="bd-duello-baslik-satir">
          <h2><Ikon ad="yildiz" boyut={20} /> {ceviri("Altın Soru")}</h2>
          {sayac(true)}
        </div>
        <p className="alt-yazi">
          {d.altin?.ben_cevapladim
            ? ceviri("Cevabın kilitlendi. Rakip bekleniyor…")
            : ceviri("Can ve doğru sayısı eşit. Tek doğru bilen kazanır — joker yok.")}
        </p>
        {soruBlogu(!d.altin?.ben_cevapladim)}
      </div>
    );
  }

  const jokerSeti = d.faz === "altin" ? null : benSaldiran ? "saldiri" : "savunma";

  // ---------------- faz halesi (2C-C) ----------------
  // Ekran kenarında: saldırıda turuncu (sabit), savunmada mavi → süre azaldıkça kırmızı.
  // Kırmızıya tam geçiş sayacın "kritik" eşiğiyle (≤3 sn) aynı an. Renk tek başına yetmez:
  // yanında ikonlu metin bandı var. Hale portal + position:fixed, transform YOK (iOS).
  const rolFazi = ["kategori", "hazirlik", "cevap"].includes(d.faz);
  let kirmizilik = 0;
  if (rolFazi && benSavunan && d.faz === "cevap") {
    const hs = haleSureRef.current;
    if (hs.anahtar !== fazAnahtari) { hs.anahtar = fazAnahtari; hs.sn = kalanSn; } else hs.sn = Math.max(hs.sn, kalanSn);
    kirmizilik = kalanSn <= 3 ? 1 : Math.min(1, Math.max(0, (hs.sn - kalanSn) / Math.max(1, hs.sn - 3))) * 0.7;
  }
  const hale = rolFazi && createPortal(
    <div key={`${d.faz}-${d.tur}-${d.saldiri_sirasi}-${benSaldiran}`}
         className={`bd-duello-hale ${benSaldiran ? "saldiri" : "savunma"} ${kirmizilik >= 1 ? "kritik" : ""}`}
         style={{ "--hale-kirmizi": kirmizilik.toFixed(2) }} aria-hidden="true" />,
    document.body,
  );

  return (
    <div className={`bd-duello ${sonCan ? "son-can" : ""}`}>
      {hale}
      <div className="bd-duello-ust">
        {oyuncuKart(ben, "sol")}
        <div className="bd-duello-tur">
          <span>{ceviri("Tur")}</span>
          <b>{d.tur}/{d.max_tur}</b>
          {!d.dereceli && <small>{ceviri("Serbest")}</small>}
        </div>
        {oyuncuKart(rakip, "sag")}
      </div>
      {rolFazi && (
        <div className={`bd-duello-rol ${benSaldiran ? "saldiri" : "savunma"} ${kirmizilik >= 1 ? "kritik" : ""}`}>
          <Ikon ad={benSaldiran ? "kilic" : "kalkan"} boyut={20} />
          <span>{benSaldiran ? ceviri("SALDIRIYORSUN") : ceviri("SAVUNUYORSUN")}</span>
        </div>
      )}
      {/* Paket 24 · A.4: bağlantı kopması. Kopukken sunucu fazları İLERLETMEZ —
          geri dönen oyuncu canlarını kaybetmiş olmaz. Süre dolarsa bekleyen kazanır. */}
      {d.durum === "aktif" && baglanti?.kopuk && (
        <div className="bd-duello-bant kopuk" role="status">
          <Ikon ad="uyari" boyut={18} />
          <span>
            {baglanti.ben_mi
              ? ceviri("Bağlantın koptu — düello bekliyor.")
              : ceviri("Rakibin bağlantısı koptu — düello durduruldu.")}
            {baglanti.kalan_sn === null || baglanti.kalan_sn === undefined
              ? ""
              : ` ${baglanti.kalan_sn} ${ceviri("sn")}`}
          </span>
        </div>
      )}
      {ezeliMetin && <div className="bd-duello-ezeli">{ezeliMetin}</div>}
      {d.durum === "aktif" && (ben.can <= 0 || rakip.can <= 0) && (
        <div className="bd-duello-bant kural">
          {ceviri("Eşit hamle kuralı: canı biten oyuncu bu turdaki saldırısını yine de yapar, tur tamamlanınca maç biter.")}
        </div>
      )}

      <div className="bd-duello-sahne" key={`${d.faz}-${d.tur}-${d.saldiri_sirasi}`}>{sahne}</div>

      {hata && <div className="hata-kutu">{hata}</div>}

      {jokerSeti && (
        <JokerAlani
          set={jokerSeti}
          d={d}
          calisan={calisan}
          onKullan={async (tur) => {
            const ok = await eylem(`joker-${tur}`,
              jokerSeti === "saldiri" ? "duello_saldiri_jokeri" : "duello_savunma_jokeri",
              { p_tur: tur });
            if (ok) { sesJoker(); titret(10); }
          }}
          // Paket 27 C: envanterde 0 varsa maç içinde satın alma penceresi açılır.
          onSatinAl={(tur, yalnizAl) => setSatinAlinacak({ tur, yalnizAl: Boolean(yalnizAl) })}
          ceviri={ceviri}
        />
      )}

      {satinAlinacak && (
        <JokerSatinAlModal
          tur={satinAlinacak.tur}
          yalnizAl={satinAlinacak.yalnizAl}
          fiyat={Number(d.jokerler?.fiyatlar?.[satinAlinacak.tur] ?? 0)}
          coin={Number(d.jokerler?.coin ?? 0)}
          onKapat={() => setSatinAlinacak(null)}
          onOnay={async () => {
            if (satinAlinacak.yalnizAl) {
              // Kategori ekranı: joker envantere girer, KULLANILMAZ.
              // Kullanım Saldırı Hazırlığı'nda normal yoldan yapılır.
              const { error } = await supabase.rpc("joker_tek_al", { p_tur: satinAlinacak.tur });
              if (error) throw error;
            } else {
              // Satın alma + kullanım TEK RPC: araya girip coin düşüp jokerin
              // kullanılmaması diye bir durum oluşmaz.
              const { error } = await supabase.rpc("joker_al_ve_kullan", {
                p_mac_tur: "duello",
                p_mac_id: id,
                p_soru_index: null,
                p_tur: satinAlinacak.tur,
              });
              if (error) throw error;
            }
            sesJoker();
            titret(10);
            coinTazele();
            await yukle();
          }}
        />
      )}

      {terkOnay ? (
        <div className="bd-duello-terk-onay" role="alertdialog">
          <span>{ceviri("Düellodan çıkarsan hükmen kaybedersin. Emin misin?")}</span>
          <div className="bd-konum-butonlar">
            <button type="button" className="btn tehlike kucuk" disabled={!!calisan}
                    onClick={() => { setTerkOnay(false); eylem("terk", "duello_terk", {}); }}>
              {ceviri("Çık")}
            </button>
            <button type="button" className="btn ikincil kucuk" onClick={() => setTerkOnay(false)}>
              {ceviri("Vazgeç")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="bd-duello-terk" disabled={!!calisan} onClick={() => setTerkOnay(true)}>
          {ceviri("Düellodan çık")}
        </button>
      )}
    </div>
  );
}

function SonHamleOzet({ h, ben, ceviri, buyuk = false, secenekler = null }) {
  let metin;
  if (h.dogru && h.riskli) {
    metin = h.saldiran === ben
      ? ceviri("Riskli saldırı geri tepti — sen can kaybettin!")
      : ceviri("En zayıf kategorinde savuşturdun — rakip can kaybetti!");
  } else if (h.dogru) {
    metin = h.savunan === ben ? ceviri("Savuşturdun!") : ceviri("Rakip saldırıyı savuşturdu.");
  } else if (h.cevap === null || h.cevap === undefined) {
    metin = h.savunan === ben ? ceviri("Süre doldu — can kaybettin.") : ceviri("Rakibin süresi doldu — can kaybetti!");
  } else {
    metin = h.savunan === ben ? ceviri("Yanlış — can kaybettin.") : ceviri("İsabet! Rakip can kaybetti.");
  }
  const iyi = h.can_kaybeden && h.can_kaybeden !== ben;
  // Paket 20 IV.2: yanlış/süre dolduysa doğru cevap METİNLE yazılır (yalnız renk yetmiyordu; C düğmesi "üçüncü" okunabiliyordu)
  const dogruMetin = !h.dogru && secenekler && h.dogru_cevap != null ? secenekler[h.dogru_cevap] : null;
  return (
    <>
      <div className={`bd-duello-hamle ${iyi ? "iyi" : h.can_kaybeden ? "kotu" : ""} ${buyuk ? "buyuk" : ""}`}>{metin}</div>
      {dogruMetin && (
        <div className="bd-duello-dogru-cevap">{ceviri("Doğru cevap: {harf} · {metin}", { harf: HARFLER[h.dogru_cevap], metin: dogruMetin })}</div>
      )}
    </>
  );
}

/** Paket 20 IV.2 — maç altın soruyla bittiyse o sorunun doğru cevabı sonuç ekranında. */
function AltinSonucu({ h, ben, soru, secenekler, ceviri }) {
  const benim = h.cevaplar?.[ben];
  const dogru = h.dogru_cevap;
  return (
    <div className="bd-duello-altin-sonuc">
      <div className="bd-mac-soru-etiket">{ceviri("Altın Soru")}</div>
      {soru && <div className="bd-mac-soru-metin">{soru}</div>}
      <div className="bd-duello-dogru-cevap">{ceviri("Doğru cevap: {harf} · {metin}", { harf: HARFLER[dogru], metin: secenekler[dogru] })}</div>
      {benim && benim.cevap != null && !benim.dogru && (
        <div className="bd-mac-soru-not ayri">{ceviri("Senin cevabın: {harf} · {metin}", { harf: HARFLER[benim.cevap], metin: secenekler[benim.cevap] })}</div>
      )}
    </div>
  );
}

function JokerAlani({ set, d, calisan, onKullan, onSatinAl, ceviri }) {
  const j = d.jokerler ?? {};
  const env = j.envanter ?? {};
  const k = j.kullanim ?? {};
  const benSaldiran = d.saldiran === d.ben;
  const liste = set === "saldiri" ? SALDIRI_JOKERLERI : MAC_ICI_JOKERLER;

  const saldiriAcik = benSaldiran && d.faz === "hazirlik";
  // Paket 28 D: saldırı jokerleri KATEGORİ ekranında da SATIN ALINABİLİR.
  // Hazırlık yalnız 4 saniye; jokeri olmayan oyuncunun o sürede altın rozeti
  // fark edip onayı okuyup onaylaması çok dardı. Satın alma kategori seçerken
  // (20 sn) yapılır, KULLANIM yine Hazırlık'ta kalır — maç ritmi uzamaz.
  const saldiriAlinabilir = benSaldiran && (d.faz === "hazirlik" || d.faz === "kategori");
  const savunmaAcik = !benSaldiran && d.faz === "cevap" && !d.savunma_kilidi;
  // Paket 27 B: saldırı ve savunma ayrı ayrı değil, TEK toplam hak sayılır.
  const hakKaldi = Number(j.kullanilan ?? 0) < Number(j.hak ?? 0);
  const saldiriHakKaldi = hakKaldi;
  const savunmaHakKaldi = hakKaldi;
  // Düelloda hiçbir joker artık ücretsiz değil (Paket 27 B.1.1 / B.1.4).
  const ucretsizSaldiri = false;
  // Maçta zaten kullanılmış türler — aynı joker maç başına bir kez.
  const kullanilanTurler = Array.isArray(k.turler) ? k.turler : [];
  const fiyatlar = j.fiyatlar ?? {};
  const setAcik = set === "saldiri" ? saldiriAcik : savunmaAcik;
  // Paket 20 IV.4: jokerler "yok" sanılıyordu — kapalıyken NEDEN kapalı olduğu yazılır
  const ipucu = !hakKaldi
    ? ceviri("Bu maçtaki joker hakkın doldu.")
    : set === "saldiri"
      ? (setAcik
          ? ceviri("Şimdi kullanabilirsin — soru rakibe gitmeden.")
          : saldiriAlinabilir
            // Paket 28 D: kategori seçerken kullanılamaz ama SATIN ALINABİLİR.
            ? ceviri("Jokerin yoksa şimdi alabilirsin; kullanımı Saldırı Hazırlığı'nda açılır.")
            : ceviri("Saldırı sırasında, soruyu gördüğün Saldırı Hazırlığı'nda açılır."))
      : d.faz === "cevap" && d.savunma_kilidi
        ? ceviri("Rakip Savunma Kilidi kullandı: bu soruda savunma jokeri yok.")
        : (setAcik ? ceviri("Şimdi kullanabilirsin.") : ceviri("Soru sana gelince açılır."));

  return (
    <div className={`bd-duello-jokerler ${set} ${(setAcik || (set === "saldiri" && saldiriAlinabilir)) && hakKaldi ? "acik" : "kapali"}`} key={`${set}-${setAcik && hakKaldi}`} aria-label={set === "saldiri" ? ceviri("Saldırı jokerleri") : ceviri("Savunma jokerleri")}>
      <div className="bd-duello-joker-baslik">
        {set === "saldiri" ? ceviri("Saldırı jokerleri") : ceviri("Savunma jokerleri")}
        {set === "savunma" && d.savunma_kilidi && d.faz === "cevap" && <span className="kilitli"><Ikon ad="kilit" boyut={13} /></span>}
      </div>
      <div className="bd-duello-joker-ipucu" role="status">{ipucu}</div>
      <div className="bd-duello-joker-sira">
        {liste.map((tur) => {
          const adet = Number(env[tur] ?? 0);
          const fiyat = Number(fiyatlar[tur] ?? 0);
          let ucretsiz = false;
          let kullanildi = false;
          let acik;
          if (set === "saldiri") {
            ucretsiz = ucretsizSaldiri;
            kullanildi = (tur === "zaman_baskisi" && d.zaman_baskisi) || (tur === "savunma_kilidi" && d.savunma_kilidi)
              || (tur === "saldiri_degistir" && d.soru_degisti_saldiri)
              || kullanilanTurler.includes(tur);
          } else {
            kullanildi = (tur === "elli" && (d.elli_kapali ?? []).length > 0) || (tur === "sure" && d.ek_sure)
              || kullanilanTurler.includes(tur);
          }
          // Paket 27 C: envanterde yoksa düğme KAPANMAZ — satın alma açılır.
          // Paket 28 D: satın alma penceresi KULLANIM penceresinden geniş.
          // Saldırıda kategori ekranı da dahil (20 sn); kullanım yine Hazırlık'ta.
          const alimFazi = set === "saldiri" ? saldiriAlinabilir : savunmaAcik;
          const kullanimFazi = set === "saldiri" ? saldiriAcik : savunmaAcik;
          const satilik = !kullanildi && adet <= 0 && fiyat > 0 && hakKaldi && alimFazi;
          acik = (kullanimFazi && hakKaldi && !kullanildi && (ucretsiz || adet > 0)) || satilik;
          const ad = set === "saldiri" ? SALDIRI_AD[tur] : SAVUNMA_AD[tur];
          const aciklama = set === "saldiri" ? JOKER_BILGI[tur]?.aciklama : SAVUNMA_ACIKLAMA[tur];
          return (
            <button key={tur} type="button"
                    className={`bd-duello-joker ${kullanildi ? "kullanildi" : ""} ${satilik ? "satilik" : ""}`}
                    disabled={!acik || !!calisan}
                    title={satilik ? ceviri("{0} coin — dokun, al ve kullan").replace("{0}", fiyat) : ceviri(aciklama)}
                    onClick={() => (satilik ? onSatinAl?.(tur, !kullanimFazi) : onKullan(tur))}>
              {satilik && (
                <span className="bd-joker-satilik" aria-hidden="true"><Ikon ad="coin" boyut={12} /></span>
              )}
              <Ikon ad={JOKER_BILGI[tur]?.ikon ?? "soru"} boyut={20} />
              <span className="bd-duello-joker-ad">{ceviri(ad)}</span>
              <span className={`bd-duello-joker-adet ${satilik ? "fiyat" : ""}`}>
                {satilik ? `${fiyat}` : `×${adet}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DuelloPage() {
  const { id } = useParams();
  return id ? <DuelloMac id={id} key={id} /> : <DuelloGiris />;
}
