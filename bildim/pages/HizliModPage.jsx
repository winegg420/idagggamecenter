import { useCallback, useEffect, useRef, useState } from "react";
import { hataMesaji } from "../lib/hata.js";
import { macBittiReklam } from "../lib/reklam.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import Avatar from "../../src/components/Avatar.jsx";
import Ikon from "../components/Ikon.jsx";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";

const TOPLAM_SN = 60;
const SORU_SN = 5;
const HARFLER = ["A", "B", "C", "D"];

export default function HizliModPage() {
  const navigate = useNavigate();
  const [asama, setAsama] = useState("secim"); // secim | oyun | sonuc
  const [kategoriler, setKategoriler] = useState([]);
  const [kategori, setKategori] = useState(null);
  const [oturum, setOturum] = useState(null);
  const [soru, setSoru] = useState(null);
  const [secim, setSecim] = useState(null);
  const [sonucSoru, setSonucSoru] = useState(null);
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
      try {
        const { data, error } = await supabase.rpc("hizli_mod_bitir", {
          p_oturum_id: oturumId,
        });
        if (error) throw error;
        setSonuc(Array.isArray(data) ? data[0] : data);
      } catch (e) {
        setHata(hataMesaji(e, "Oturum kapatılamadı."));
      }
      setAsama("sonuc");
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
      setTimeout(() => {
        if (s?.bitti) bitir(oturum.oturum_id);
        else soruGetir(oturum.oturum_id);
      }, 450);
    } catch (e) {
      setHata(hataMesaji(e, "Cevap gönderilemedi."));
    }
  };

  // ---------- Sayaçlar ----------
  useEffect(() => {
    if (asama !== "oyun" || !oturum) return;
    const id = setInterval(() => {
      const gecen = (Date.now() - soruBaslangicRef.current) / 1000;
      setKalanSoru(Math.max(0, SORU_SN - gecen));
      setKalanToplam((k) => Math.max(0, k - 0.1));
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
        <div className="baslik">⚡ Hızlı Mod</div>
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

        <div className="bd-kat-baslik"><span>🎯 Kategori</span></div>
        <div className="bd-kat-grid">
          <button
            className={`bd-kat-kart ${kategori === null ? "aktif" : ""}`}
            onClick={() => setKategori(null)}
          >
            <span className="bd-kat-ad">🎲 Karışık</span>
          </button>
          {kategorileriSirala(kategoriler).map((k) => (
            <button
              key={k.kategori}
              className={`bd-kat-kart ${kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => setKategori(k.kategori)}
            >
              <span className="bd-kat-ad">{kategoriEtiket(k.kategori)}</span>
              <span className="bd-kat-alt">{k.soru_sayisi} soru</span>
            </button>
          ))}
        </div>

        {hata && <div className="hata-kutu">{hata}</div>}
        <button className="bd-ana-eylem" onClick={basla}>
          <Ikon ad="hizli" boyut={22} />
          <span>BAŞLA</span>
        </button>
      </div>
    );
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
      <div className="bd-hizli-oyun">
        {/* 60 sn toplam çubuk */}
        <div className="bd-hizli-toplam">
          <div
            className="dolgu"
            style={{ width: `${(kalanToplam / TOPLAM_SN) * 100}%` }}
          />
        </div>
        <div className="bd-hizli-ust">
          <span className="bd-hizli-skor">✓ {skor}</span>
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

            <div className="bd-soru-metin">{soru.soru}</div>

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
          <button className="btn ikincil" onClick={() => navigate("/bildim")}>Ana sayfa</button>
        </div>
      </div>

      <div className="bd-kat-baslik"><span>🏅 Haftalık sıralama</span></div>
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
                  {s.gorunen_ad} {s.ben && <span className="bd-sen">sen</span>}
                </div>
              </div>
              <span className="bd-lig-puan">✓ {s.skor}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
