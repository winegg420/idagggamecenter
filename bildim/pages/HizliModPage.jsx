import { useCallback, useEffect, useRef, useState } from "react";
import KategoriIkon from "../components/KategoriIkon.jsx";
import SureDolduGecis from "../components/SureDolduGecis.jsx";
import { sesKilidiAc, sesTik, sesDogru, sesYanlis, sesDokunus } from "../lib/ses.js";
import CevapEfekti from "../components/CevapEfekti.jsx";
import { GB_HIZLI_MS, titret } from "../lib/geriBildirim.js";
import { hataMesaji } from "../lib/hata.js";
import { macBittiReklam } from "../lib/reklam.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import Ikon from "../components/Ikon.jsx";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";
import { y } from "../lib/yol.js";
import { useGorunurlukTazele } from "../lib/gorunurluk.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { ayar } from "../lib/ayarlar.js";
import { coinTazele } from "../lib/coin.js";
import DereceliAnahtari from "../components/DereceliAnahtari.jsx";
import { useDereceliTercih } from "../lib/dereceli.js";
import { useDil } from "../lib/dilKanca.js";

// Süreler sunucudan gelir (oyun_ayarlari: hizli_mod_sure_sn / hizli_mod_soru_sure_sn;
// oturum açılınca hizli_mod_baslat da döndürür). Bunlar yalnız ilk çizim içindir.
const VARSAYILAN_TOPLAM_SN = 90;
const VARSAYILAN_SORU_SN = 10;
const HARFLER = ["A", "B", "C", "D"];

export default function HizliModPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [asama, setAsama] = useState("secim"); // secim | oyun | gecis | sonuc
  const [kategoriler, setKategoriler] = useState([]);
  const [kategori, setKategori] = useState(null);
  const [oturum, setOturum] = useState(null);
  const [soru, setSoru] = useState(null);
  const [secim, setSecim] = useState(null);
  const [sonucSoru, setSonucSoru] = useState(null);
  const [seri, setSeri] = useState(0);
  const [sarsil, setSarsil] = useState(false);
  const [skor, setSkor] = useState(0);
  const [sureler, setSureler] = useState({ toplam: VARSAYILAN_TOPLAM_SN, soru: VARSAYILAN_SORU_SN });
  const TOPLAM_SN = sureler.toplam;
  const SORU_SN = sureler.soru;
  const soruSnRef = useRef(VARSAYILAN_SORU_SN);
  // Toplam süre duvar saatine göre akar: { kalan: sunucunun son bildirdiği sn, an: o anın Date.now() }.
  // (Eskiden her 100 ms tikte 0.1 düşülüyordu; tarayıcı zamanlayıcıyı kısınca sayaç geride kalıyordu.)
  const toplamRef = useRef({ kalan: VARSAYILAN_TOPLAM_SN, an: Date.now() });
  const toplamAyarla = (kalan) => {
    toplamRef.current = { kalan, an: Date.now() };
    setKalanToplam(kalan);
  };
  const [kalanToplam, setKalanToplam] = useState(VARSAYILAN_TOPLAM_SN);
  const [kalanSoru, setKalanSoru] = useState(VARSAYILAN_SORU_SN);
  const [sonuc, setSonuc] = useState(null);
  const [dereceli, setDereceli] = useDereceliTercih();
  const [odul, setOdul] = useState({ dogru: 3, tavan: 25 });
  const { ceviri } = useDil();
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);

  const soruBaslangicRef = useRef(Date.now());
  // Sayaç tiki: sekmeden dönüşte dışarıdan elle tetiklenebilsin.
  const tikRef = useRef(null);
  const bittiRef = useRef(false);
  const sonTikRef = useRef(null);

  useEffect(() => { sesKilidiAc(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const toplam = await ayar("hizli_mod_sure_sn", VARSAYILAN_TOPLAM_SN);
        const soruSn = await ayar("hizli_mod_soru_sure_sn", VARSAYILAN_SORU_SN);
        soruSnRef.current = soruSn;
        setSureler({ toplam, soru: soruSn });
        setOdul({
          dogru: await ayar("hizli_mod_puan_dogru", 3),
          tavan: await ayar("hizli_mod_lig_tavan", 25),
        });
      } catch (e) {
        console.error("[Bildim] hizli mod sureleri okunamadi:", e);
      }
    })();
  }, []);

  useEffect(() => {
    supabase.rpc("get_categories").then(({ data }) => setKategoriler(data ?? []));
    supabase.rpc("hizli_mod_ozetim").then(({ data }) => {
      const o = Array.isArray(data) ? data[0] : data;
      if (o) setOzet(o);
    });
  }, []);

  // ---------- Soru getir ----------
  const soruGetir = useCallback(async (oturumId) => {
    try {
      const { data, error } = await supabase.rpc("hizli_mod_soru", {
        p_oturum_id: oturumId,
      });
      if (error) throw error;
      const s = Array.isArray(data) ? data[0] : data;
      if (!s) throw new Error("Soru gelmedi");
      setSoru(s);
      setSecim(null);
      setSonucSoru(null);
      setKalanSoru(soruSnRef.current);
      toplamAyarla(s.kalan_toplam_sn ?? 0);
      sonTikRef.current = null;
      soruBaslangicRef.current = Date.now();
    } catch (e) {
      if (/Süre doldu/i.test(e?.message ?? "")) {
        bitir(oturumId);
      } else {
        setHata(hataMesaji(e, "Soru alınamadı."));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Başlat ----------
  const basla = async () => {
    setHata(null);
    bittiRef.current = false;
    try {
      const { data, error } = await supabase.rpc("hizli_mod_baslat", {
        p_kategori: kategori,
        p_dereceli: dereceli,
      });
      if (error) throw error;
      const o = Array.isArray(data) ? data[0] : data;
      if (!o?.oturum_id) throw new Error("Oturum açılamadı");
      const toplam = Number(o.sure_sn) || VARSAYILAN_TOPLAM_SN;
      const soruSn = Number(o.soru_sure_sn) || VARSAYILAN_SORU_SN;
      soruSnRef.current = soruSn;
      setSureler({ toplam, soru: soruSn });
      setOturum(o);
      setSkor(0);
      toplamAyarla(toplam);
      setAsama("oyun");
      await soruGetir(o.oturum_id);
    } catch (e) {
      setHata(hataMesaji(e, "Hızlı mod başlatılamadı."));
    }
  };

  // ---------- Bitir ----------
  const bitir = useCallback(
    async (oturumId) => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      // Süre bitti: önce 0.8 sn'lik "Süre doldu!" perdesi, sonra sonuç ekranı.
      // (Eskiden ekran donuk kalıp aniden sonuca atlıyordu.)
      const perdeBasi = Date.now();
      setAsama("gecis");
      try {
        const { data, error } = await supabase.rpc("hizli_mod_bitir", {
          p_oturum_id: oturumId,
        });
        if (error) throw error;
        setSonuc(Array.isArray(data) ? data[0] : data);
        // Kazanılan coin ve lig puanı üst çubuğa/ana sayfaya hemen yansısın
        coinTazele();
        refreshProfile?.(user?.id);
      } catch (e) {
        setHata(hataMesaji(e, "Oturum kapatılamadı."));
      }
      const perdeKalan = Math.max(0, 800 - (Date.now() - perdeBasi));
      setTimeout(() => setAsama("sonuc"), perdeKalan);
      macBittiReklam(profile?.created_at).catch(() => {}); // sıklık kuralı reklam.js'te
      // Paket 14 (3.9): Hızlı Mod artık ana lige puan yazıyor; ayrı haftalık
      // skor tablosu arayüzde gösterilmez (hizli_mod_skorlar yazılmaya devam eder).
      try {
        const { data, error } = await supabase.rpc("hizli_mod_ozetim");
        if (error) throw error;
        const o = Array.isArray(data) ? data[0] : data;
        if (o) setOzet(o);
      } catch (e) {
        console.error("[Bildim] hizli mod ozeti alinamadi:", e);
      }
    },
    [profile?.created_at, refreshProfile, user?.id]
  );

  // ---------- Cevapla ----------
  const cevapla = async (i) => {
    if (secim !== null || !oturum || !soru) return;
    setSecim(i);
    if (i >= 0) { sesDokunus(); titret(10); }
    try {
      const { data, error } = await supabase.rpc("hizli_mod_cevap", {
        p_oturum_id: oturum.oturum_id,
        p_soru_index: soru.soru_index,
        p_cevap: i,
      });
      if (error) throw error;
      const s = Array.isArray(data) ? data[0] : data;
      setSonucSoru(s);
      setSkor(s?.skor ?? skor);
      toplamAyarla(s?.kalan_toplam_sn ?? 0);
      if (s?.dogru) {
        sesDogru();
        titret(10);
        setSeri((x) => x + 1);
      } else {
        sesYanlis();
        titret(30);
        setSeri(0);
        setSarsil(true);
        setTimeout(() => setSarsil(false), 380);
      }
      // Hızlı modda pencere kısa: sunucu bir sonraki sorunun süresini CEVAP
      // anında başlatıyor, 700 ms 1 sn'lik ağ payının içinde kalır.
      setTimeout(() => {
        if (s?.bitti) bitir(oturum.oturum_id);
        else soruGetir(oturum.oturum_id);
      }, GB_HIZLI_MS);
    } catch (e) {
      setHata(hataMesaji(e, "Cevap gönderilemedi."));
    }
  };

  // ---------- Sayaçlar ----------
  useEffect(() => {
    if (asama !== "oyun" || !oturum) return;
    const tik = () => {
      const gecen = (Date.now() - soruBaslangicRef.current) / 1000;
      const ks = Math.max(0, soruSnRef.current - gecen);
      setKalanSoru(ks);
      const t = toplamRef.current;
      setKalanToplam(Math.max(0, t.kalan - (Date.now() - t.an) / 1000));
      // Son 2 saniyede saniyede bir tik
      if (ks > 0 && ks <= 2) {
        const sn = Math.ceil(ks);
        if (sonTikRef.current !== sn) { sonTikRef.current = sn; sesTik(sn); }
      } else if (ks > 2) {
        sonTikRef.current = null;
      }
    };
    tikRef.current = tik;
    const id = setInterval(tik, 100);
    return () => clearInterval(id);
  }, [asama, oturum]);

  // Sekmeden dönünce soru sayacını gerçek zamana göre senkronla; arka planda
  // donan setInterval yüzünden ekran kalmış sayıda takılı kalmasın.
  useGorunurlukTazele(() => { tikRef.current?.(); }, asama === "oyun");

  // Soru süresi dolunca otomatik yanlış say ve ilerle
  useEffect(() => {
    if (asama !== "oyun" || !soru || secim !== null) return;
    if (kalanSoru > 0) return;
    cevapla(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalanSoru, asama, soru, secim]);

  // Toplam süre dolunca bitir
  useEffect(() => {
    if (asama !== "oyun" || !oturum) return;
    if (kalanToplam > 0) return;
    bitir(oturum.oturum_id);
  }, [kalanToplam, asama, oturum, bitir]);

  // ============ EKRANLAR ============

  if (asama === "secim") {
    return (
      <div>
        <h1 className="baslik">Hızlı Mod</h1>
        <div className="kart bd-hizli-tanit">
          <div className="bd-hizli-buyuk">{TOPLAM_SN}</div>
          <div className="alt-yazi">
            saniyede kaç soru bilebilirsin? Soru başına <b>{SORU_SN} saniye</b>,
            doğru <b>+1</b>, yanlışın cezası yok.
            <br />
            {dereceli
              ? ceviri("Dereceli: doğru başına +{dogru} lig puanı ve coin (en çok {tavan}).", odul)
              : ceviri("Serbest: lig puanı yok, coin yarı.")}
          </div>
          {ozet && (
            <div className="bd-hizli-ozet">
              <div><b>{ozet.bu_hafta_en_iyi}</b><span>bu hafta</span></div>
              <div><b>{ozet.tum_zaman_en_iyi}</b><span>rekorun</span></div>
              <div><b>{ozet.oynanan}</b><span>oyun</span></div>
            </div>
          )}
        </div>

        <DereceliAnahtari dereceli={dereceli} onDegistir={setDereceli} />

        <div className="bd-kat-baslik"><span>Kategori</span></div>
        <div className="bd-kat-grid">
          <button
            className={`bd-kat-kart ${kategori === null ? "aktif" : ""}`}
            onClick={() => setKategori(null)}
          >
            <KategoriIkon anahtar="karisik" boyut={24} plaka />
              <span className="bd-kat-ad">Karışık</span>
          </button>
          {kategorileriSirala(kategoriler).map((k) => (
            <button
              key={k.kategori}
              className={`bd-kat-kart ${kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => setKategori(k.kategori)}
            >
              <KategoriIkon anahtar={k.kategori} boyut={24} plaka />
              <span className="bd-kat-ad">{kategoriEtiket(k.kategori)}</span>
              <span className="bd-kat-alt">{k.soru_sayisi} soru</span>
            </button>
          ))}
        </div>

        {hata && <div className="hata-kutu">{hata}</div>}
        <button className="bd-ana-eylem" onClick={basla}>
          <Ikon ad="hizli" boyut={22} />
          <span>Başla</span>
        </button>
      </div>
    );
  }

  // Süre doldu perdesi (0.8 sn) — sonuç ekranından önce
  if (asama === "gecis") {
    return <SureDolduGecis baslik="Süre doldu!" skor={sonuc?.skor ?? skor} skorEtiket="doğru" />;
  }

  if (asama === "oyun") {
    const secenekler = soru
      ? Array.isArray(soru.secenekler)
        ? soru.secenekler
        : JSON.parse(soru.secenekler)
      : [];
    const soruOran = Math.max(0, Math.min(1, kalanSoru / SORU_SN));
    const CEVRE = 2 * Math.PI * 20;

    return (
      <div className={`bd-hizli-oyun ${sarsil ? "bd-sarsil" : ""}`}>
        <CevapEfekti dogru={Boolean(sonucSoru?.dogru)} puan={0} seri={seri} />
        {secim === -1 && (
          <div className="bd-sure-doldu-bant" role="status">
            <Ikon ad="saat" boyut={15} /> Süre doldu
          </div>
        )}
        {/* Toplam süre çubuğu */}
        <div className="bd-hizli-toplam">
          <div
            className="dolgu"
            style={{ width: `${(kalanToplam / TOPLAM_SN) * 100}%` }}
          />
        </div>
        <div className="bd-hizli-ust">
          <span className="bd-hizli-skor"><Ikon ad="onay" boyut={15} /> {skor}</span>
          <span className="bd-hizli-sn">{Math.ceil(kalanToplam)} sn</span>
        </div>

        {soru && (
          <>
            {/* Soru süresi halkası */}
            <div className="bd-sure-halka bd-hizli-halka">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <circle className="iz" cx="24" cy="24" r="20" />
                <circle
                  className="dolgu"
                  cx="24" cy="24" r="20"
                  stroke={kalanSoru <= 2 ? "var(--danger)" : "var(--primary)"}
                  strokeDasharray={CEVRE}
                  strokeDashoffset={CEVRE * (1 - soruOran)}
                />
              </svg>
              <span className={`bd-sure-sayi ${kalanSoru <= 2 ? "kritik" : ""}`}>
                {Math.ceil(kalanSoru)}
              </span>
            </div>

            <div className="bd-soru-metin bd-soru-giris" key={soru.soru_index}>
              {soru.soru}
            </div>

            <div className="bd-secenekler">
              {secenekler.map((s, i) => {
                let sinif = "bd-secenek";
                if (sonucSoru) {
                  if (i === sonucSoru.dogru_cevap) sinif += " dogru";
                  else if (i === secim) sinif += " yanlis";
                  else sinif += " solgun";
                } else if (i === secim) sinif += " secili";
                return (
                  <button
                    key={i}
                    className={sinif}
                    disabled={secim !== null}
                    onClick={() => cevapla(i)}
                  >
                    <span className="bd-harf">{HARFLER[i]}</span>
                    <span className="bd-secenek-metin">{s}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {hata && <div className="hata-kutu">{hata}</div>}
      </div>
    );
  }

  // ---------- Sonuç ----------
  return (
    <div>
      <div className="kart bd-hizli-sonuc">
        <div className="bd-hizli-buyuk">{sonuc?.skor ?? skor}</div>
        <div className="alt-yazi">doğru cevap</div>
        <div className="bd-hizli-ozet" style={{ marginTop: 14 }}>
          <div><b>{sonuc?.dogru ?? skor}</b><span>doğru</span></div>
          <div><b>{sonuc?.yanlis ?? 0}</b><span>yanlış</span></div>
          <div><b>{sonuc?.en_iyi_hafta ?? skor}</b><span>hafta en iyi</span></div>
        </div>
        <div className="bd-kazanc-satiri">
          {sonuc?.dereceli !== false && (
            <span className="bd-sonuc-kazanc">
              {ceviri("+{puan} lig puanı", { puan: sonuc?.lig_puan ?? 0 })}
            </span>
          )}
          <span className="bd-sonuc-kazanc">
            {ceviri("+{coin} coin", { coin: sonuc?.kazanilan_coin ?? 0 })}
          </span>
        </div>
        <div className="bd-konum-butonlar" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setAsama("secim")}>Tekrar oyna</button>
          <button className="btn ikincil" onClick={() => navigate(y())}>Ana sayfa</button>
        </div>
      </div>

    </div>
  );
}
