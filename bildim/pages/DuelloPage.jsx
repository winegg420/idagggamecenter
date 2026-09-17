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
import MacSorulari from "../components/MacSorulari.jsx";
import HesapGuvenceOnerisi from "../components/HesapGuvence.jsx";
import DereceliAnahtari from "../components/DereceliAnahtari.jsx";
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
      <button className="bd-ana-eylem" onClick={() => { sesKilidiAc(); setArama(true); }}>
        <Ikon ad="kilic" boyut={22} />
        <span>{ceviri("Rakip ara")}</span>
      </button>
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
  const [simdi, setSimdi] = useState(Date.now());
  const [secim, setSecim] = useState(null);
  const [calisan, setCalisan] = useState(null);
  const [terkOnay, setTerkOnay] = useState(false);
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
      const { data, error } = await supabase.rpc("duello_durum", { p_id: id });
      if (error) throw error;
      if (data) {
        farkRef.current = new Date(data.sunucu_zamani).getTime() - Date.now();
        setD(data);
        setYuklemeHatasi(null);
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
          <MacSorulari kaynak={`duello:${d.id}`} />
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
        {h && <SonHamleOzet h={h} ben={d.ben} ceviri={ceviri} buyuk />}
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
      {ezeliMetin && <div className="bd-duello-ezeli">{ezeliMetin}</div>}

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
          ceviri={ceviri}
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

function SonHamleOzet({ h, ben, ceviri, buyuk = false }) {
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
  return <div className={`bd-duello-hamle ${iyi ? "iyi" : h.can_kaybeden ? "kotu" : ""} ${buyuk ? "buyuk" : ""}`}>{metin}</div>;
}

function JokerAlani({ set, d, calisan, onKullan, ceviri }) {
  const j = d.jokerler ?? {};
  const env = j.envanter ?? {};
  const k = j.kullanim ?? {};
  const benSaldiran = d.saldiran === d.ben;
  const liste = set === "saldiri" ? SALDIRI_JOKERLERI : MAC_ICI_JOKERLER;

  const saldiriAcik = benSaldiran && d.faz === "hazirlik";
  const savunmaAcik = !benSaldiran && d.faz === "cevap" && !d.savunma_kilidi;
  const saldiriHakKaldi = Number(k.saldiri ?? 0) < Number(j.saldiri_siniri ?? 0);
  const savunmaHakKaldi = Number(k.savunma ?? 0) < Number(j.savunma_siniri ?? 0);
  const ucretsizSaldiri = Number(k.saldiri_ucretsiz ?? 0) < Number(j.ucretsiz_saldiri ?? 0);

  return (
    <div className={`bd-duello-jokerler ${set}`} key={set} aria-label={set === "saldiri" ? ceviri("Saldırı jokerleri") : ceviri("Savunma jokerleri")}>
      <div className="bd-duello-joker-baslik">
        {set === "saldiri" ? ceviri("Saldırı jokerleri") : ceviri("Savunma jokerleri")}
        {set === "savunma" && d.savunma_kilidi && d.faz === "cevap" && <span className="kilitli"><Ikon ad="kilit" boyut={13} /></span>}
      </div>
      <div className="bd-duello-joker-sira">
        {liste.map((tur) => {
          const adet = Number(env[tur] ?? 0);
          let ucretsiz = false;
          let kullanildi = false;
          let acik;
          if (set === "saldiri") {
            ucretsiz = ucretsizSaldiri;
            kullanildi = (tur === "zaman_baskisi" && d.zaman_baskisi) || (tur === "savunma_kilidi" && d.savunma_kilidi)
              || (tur === "saldiri_degistir" && d.soru_degisti_saldiri);
            acik = saldiriAcik && saldiriHakKaldi && !kullanildi && (ucretsiz || adet > 0);
          } else {
            ucretsiz = tur === "elli" && !k.elli_ucretsiz;
            kullanildi = (tur === "elli" && (d.elli_kapali ?? []).length > 0) || (tur === "sure" && d.ek_sure)
              || (tur === "soru_degistir" && k.soru_degistir);
            acik = savunmaAcik && savunmaHakKaldi && !kullanildi && (ucretsiz || adet > 0);
          }
          const ad = set === "saldiri" ? SALDIRI_AD[tur] : SAVUNMA_AD[tur];
          const aciklama = set === "saldiri" ? JOKER_BILGI[tur]?.aciklama : SAVUNMA_ACIKLAMA[tur];
          return (
            <button key={tur} type="button" className={`bd-duello-joker ${kullanildi ? "kullanildi" : ""}`}
                    disabled={!acik || !!calisan} title={ceviri(aciklama)}
                    onClick={() => onKullan(tur)}>
              <Ikon ad={JOKER_BILGI[tur]?.ikon ?? "soru"} boyut={20} />
              <span className="bd-duello-joker-ad">{ceviri(ad)}</span>
              <span className="bd-duello-joker-adet">{ucretsiz ? ceviri("ücretsiz") : `×${adet}`}</span>
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
