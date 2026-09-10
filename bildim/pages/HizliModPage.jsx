import { useCallback, useEffect, useRef, useState } from "react";
import KategoriIkon from "../components/KategoriIkon.jsx";
import SenRozeti from "../components/SenRozeti.jsx";
import SureDolduGecis from "../components/SureDolduGecis.jsx";
import { sesKilidiAc, sesTik, sesDogru, sesYanlis, sesDokunus } from "../lib/ses.js";
import CevapEfekti from "../components/CevapEfekti.jsx";
import { GB_HIZLI_MS, titret } from "../lib/geriBildirim.js";
import { hataMesaji } from "../lib/hata.js";
import { macBittiReklam } from "../lib/reklam.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import Avatar from "../../src/components/Avatar.jsx";
import Ikon from "../components/Ikon.jsx";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";
import { y } from "../lib/yol.js";

const TOPLAM_SN = 60;
const SORU_SN = 5;
const HARFLER = ["A", "B", "C", "D"];

export default function HizliModPage() {
  const navigate = useNavigate();
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
  const [kalanToplam, setKalanToplam] = useState(TOPLAM_SN);
  const [kalanSoru, setKalanSoru] = useState(SORU_SN);
  const [sonuc, setSonuc] = useState(null);
  const [siralama, setSiralama] = useState([]);
  const [kapsam, setKapsam] = useState("global");
  const [ozet, setOzet] = useState(null);
  const [hata, setHata] = useState(null);

  const soruBaslangicRef = useRef(Date.now());
  const bittiRef = useRef(false);
  const sonTikRef = useRef(null);

  useEffect(() => { sesKilidiAc(); }, []);

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
      setKalanSoru(SORU_SN);
      setKalanToplam(s.kalan_toplam_sn ?? 0);
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
      });
      if (error) throw error;
      const o = Array.isArray(data) ? data[0] : data;
      if (!o?.oturum_id) throw new Error("Oturum açılamadı");
      setOturum(o);
      setSkor(0);
      setKalanToplam(TOPLAM_SN);
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
      } catch (e) {
        setHata(hataMesaji(e, "Oturum kapatılamadı."));
      }
      const perdeKalan = Math.max(0, 800 - (Date.now() - perdeBasi));
      setTimeout(() => setAsama("sonuc"), perdeKalan);
      macBittiReklam().catch(() => {}); // sıklık kuralı reklam.js'te
      try {
        const { data } = await supabase.rpc("hizli_mod_siralama", { p_kapsam: kapsam });
        setSiralama(data ?? []);
      } catch {
        setSiralama([]);
      }
      supabase.rpc("hizli_mod_ozetim").then(({ data }) => {
        const o = Array.isArray(data) ? data[0] : data;
        if (o) setOzet(o);
      });
    },
    [kapsam]
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
      setKalanToplam(s?.kalan_toplam_sn ?? 0);
      if (s?.dogru) {
        sesDogru();
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
    const id = setInterval(() => {
      const gecen = (Date.now() - soruBaslangicRef.current) / 1000;
      const ks = Math.max(0, SORU_SN - gecen);
      setKalanSoru(ks);
      setKalanToplam((k) => Math.max(0, k - 0.1));
      // Soru başına 5 sn; son 2 saniyede saniyede bir tik
      if (ks > 0 && ks <= 2) {
        const sn = Math.ceil(ks);
        if (sonTikRef.current !== sn) { sonTikRef.current = sn; sesTik(sn); }
      } else if (ks > 2) {
        sonTikRef.current = null;
      }
    }, 100);
    return () => clearInterval(id);
  }, [asama, oturum]);

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

  // Sıralama kapsamı değişince yenile
  useEffect(() => {
    if (asama !== "sonuc") return;
    supabase
      .rpc("hizli_mod_siralama", { p_kapsam: kapsam })
      .then(({ data, error }) => {
        if (!error) setSiralama(data ?? []);
      })
      .catch(() => {});
  }, [kapsam, asama]);

  // ============ EKRANLAR ============

  if (asama === "secim") {
    return (
      <div>
        <div className="baslik">Hızlı Mod</div>
        <div className="kart bd-hizli-tanit">
          <div className="bd-hizli-buyuk">60</div>
          <div className="alt-yazi">
            saniyede kaç soru bilebilirsin? Soru başına <b>5 saniye</b>,
            doğru <b>+1</b>, yanlışın cezası yok.
            <br />
            <b>Lig puanına girmez</b> — kendi haftalık sıralaması var.
          </div>
          {ozet && (
            <div className="bd-hizli-ozet">
              <div><b>{ozet.bu_hafta_en_iyi}</b><span>bu hafta</span></div>
              <div><b>{ozet.tum_zaman_en_iyi}</b><span>rekorun</span></div>
              <div><b>{ozet.oynanan}</b><span>oyun</span></div>
            </div>
          )}
        </div>

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
        {/* 60 sn toplam çubuk */}
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
            {/* 5 sn soru halkası */}
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
        <div className="bd-konum-butonlar" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setAsama("secim")}>Tekrar oyna</button>
          <button className="btn ikincil" onClick={() => navigate(y())}>Ana sayfa</button>
        </div>
      </div>

      <div className="bd-kat-baslik"><span>Haftalık sıralama</span></div>
      <div className="bd-sekme-ust">
        {[
          { id: "sehir", etiket: "ŞEHİR" },
          { id: "ulke", etiket: "ÜLKE" },
          { id: "global", etiket: "DÜNYA" },
        ].map((k) => (
          <button
            key={k.id}
            className={`bd-sekme ${kapsam === k.id ? "aktif" : ""}`}
            onClick={() => setKapsam(k.id)}
          >
            {k.etiket}
          </button>
        ))}
      </div>

      <div className="bd-lig-liste">
        {siralama.length === 0 ? (
          <div className="alt-yazi" style={{ textAlign: "center", padding: 18 }}>
            Bu hafta bu kapsamda henüz skor yok.
          </div>
        ) : (
          siralama.map((s) => (
            <div key={s.user_id} className={`bd-lig-satir ${s.ben ? "ben" : ""}`}>
              <span className="bd-sira">{s.sira}</span>
              <Avatar
                profile={{ gorunen_ad: s.gorunen_ad, gorunen_avatar: s.gorunen_avatar }}
                boyut={34}
              />
              <div className="bd-lig-bilgi">
                <div className="bd-lig-isim">
                  {s.gorunen_ad}{s.ben && <SenRozeti />}
                </div>
              </div>
              <span className="bd-lig-puan">{s.skor}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
