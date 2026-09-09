import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import KategoriIkon from "../components/KategoriIkon.jsx";
import Maskot from "../components/Maskot.jsx";
import Ikon from "../components/Ikon.jsx";
import Konfeti from "../components/Konfeti.jsx";
import { sesKilidiAc, sesTik, sesDogru, sesYanlis, sesKazandin } from "../lib/ses.js";
import { hataMesaji } from "../lib/hata.js";
import { supabase } from "../../src/lib/supabase.js";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";

const SORU_SN = 20;
const HARFLER = ["A", "B", "C", "D"];
const SORU_SECENEKLERI = [10, 20, 30];

/**
 * Hatalarım — puansız, tek kişilik çalışma modu.
 * Lig puanı vermez; yalnız kategori ustalığına ve öğrenilen soru sayacına işler.
 */
export default function CalismaPage() {
  const navigate = useNavigate();
  const [asama, setAsama] = useState("secim"); // secim | oyun | sonuc
  const [banka, setBanka] = useState(null); // { toplam, ogrenilen, bekleyen, kategoriler[] }
  const [kategoriler, setKategoriler] = useState([]);
  const [kategori, setKategori] = useState(null);
  const [soruSayisi, setSoruSayisi] = useState(10);
  const [oturum, setOturum] = useState(null);
  const [soru, setSoru] = useState(null);
  const [secim, setSecim] = useState(null);
  const [sonucSoru, setSonucSoru] = useState(null);
  const [kalan, setKalan] = useState(SORU_SN);
  const [sonuc, setSonuc] = useState(null);
  const [kutlama, setKutlama] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState(null);

  const soruBaslangicRef = useRef(Date.now());
  const bittiRef = useRef(false);
  const sonTikRef = useRef(null);

  useEffect(() => {
    sesKilidiAc();
  }, []);

  // ---------- Banka özeti ----------
  const bankaYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("yanlis_bankam");
      if (error) throw error;
      const satirlar = data ?? [];
      const ilk = satirlar[0] ?? { toplam: 0, ogrenilen: 0, bekleyen: 0 };
      setBanka({
        toplam: ilk.toplam ?? 0,
        ogrenilen: ilk.ogrenilen ?? 0,
        bekleyen: ilk.bekleyen ?? 0,
        kategoriler: satirlar.filter((s) => s.kategori),
      });
    } catch (e) {
      // Banka okunamazsa mod yine açılabilmeli
      setBanka({ toplam: 0, ogrenilen: 0, bekleyen: 0, kategoriler: [] });
      setHata(hataMesaji(e, "Banka özeti alınamadı."));
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    bankaYukle();
    supabase
      .rpc("get_categories")
      .then(({ data }) => setKategoriler(data ?? []))
      .catch(() => setKategoriler([]));
  }, [bankaYukle]);

  // ---------- Soru getir ----------
  const soruGetir = useCallback(async (oturumId) => {
    try {
      const { data, error } = await supabase.rpc("calisma_soru", {
        p_oturum_id: oturumId,
      });
      if (error) throw error;
      const s = Array.isArray(data) ? data[0] : data;
      if (!s) throw new Error("Soru gelmedi");
      setSoru(s);
      setSecim(null);
      setSonucSoru(null);
      setKalan(SORU_SN);
      sonTikRef.current = null;
      soruBaslangicRef.current = Date.now();
    } catch (e) {
      setHata(hataMesaji(e, "Soru alınamadı."));
    }
  }, []);

  // ---------- Bitir ----------
  const bitir = useCallback(async (oturumId) => {
    if (bittiRef.current) return;
    bittiRef.current = true;
    try {
      const { data, error } = await supabase.rpc("calisma_bitir", {
        p_oturum_id: oturumId,
      });
      if (error) throw error;
      setSonuc(Array.isArray(data) ? data[0] : data);
    } catch (e) {
      setHata(hataMesaji(e, "Tur kapatılamadı."));
    }
    setAsama("sonuc");
    bankaYukle();
  }, [bankaYukle]);

  // ---------- Başlat ----------
  const basla = async () => {
    setHata(null);
    setCalisiyor(true);
    bittiRef.current = false;
    try {
      const { data, error } = await supabase.rpc("calisma_baslat", {
        p_kategori: kategori,
        p_soru_sayisi: soruSayisi,
      });
      if (error) throw error;
      const o = Array.isArray(data) ? data[0] : data;
      if (!o?.oturum_id) throw new Error("Tur açılamadı");
      setOturum(o);
      setSonuc(null);
      setAsama("oyun");
      await soruGetir(o.oturum_id);
    } catch (e) {
      setHata(hataMesaji(e, "Çalışma turu başlatılamadı."));
    } finally {
      setCalisiyor(false);
    }
  };

  // ---------- Cevapla ----------
  const cevapla = async (i) => {
    if (secim !== null || !oturum || !soru) return;
    setSecim(i);
    try {
      const { data, error } = await supabase.rpc("calisma_cevap", {
        p_oturum_id: oturum.oturum_id,
        p_soru_index: soru.soru_index,
        p_cevap: i,
      });
      if (error) throw error;
      const s = Array.isArray(data) ? data[0] : data;
      setSonucSoru(s);
      if (s?.ogrenildi) {
        setKutlama(true);
        sesKazandin();
        setTimeout(() => setKutlama(false), 1400);
      } else if (s?.dogru) {
        sesDogru();
      } else {
        sesYanlis();
      }
      // Öğrenildi kutlaması için biraz daha uzun bekle
      setTimeout(
        () => {
          if (s?.bitti) bitir(oturum.oturum_id);
          else soruGetir(oturum.oturum_id);
        },
        s?.ogrenildi ? 1500 : 1100
      );
    } catch (e) {
      setHata(hataMesaji(e, "Cevap gönderilemedi."));
    }
  };

  // ---------- Süre sayacı ----------
  useEffect(() => {
    if (asama !== "oyun" || !soru || secim !== null) return;
    const id = setInterval(() => {
      const gecen = (Date.now() - soruBaslangicRef.current) / 1000;
      const k = Math.max(0, SORU_SN - gecen);
      setKalan(k);
      if (k > 0 && k <= 3) {
        const sn = Math.ceil(k);
        if (sonTikRef.current !== sn) {
          sonTikRef.current = sn;
          sesTik(sn);
        }
      } else if (k > 3) {
        sonTikRef.current = null;
      }
    }, 100);
    return () => clearInterval(id);
  }, [asama, soru, secim]);

  // Süre dolunca yanlış say ve ilerle
  useEffect(() => {
    if (asama !== "oyun" || !soru || secim !== null) return;
    if (kalan > 0) return;
    cevapla(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalan, asama, soru, secim]);

  // ============ SEÇİM EKRANI ============
  if (asama === "secim") {
    const bos = (banka?.bekleyen ?? 0) === 0;
    return (
      <div>
        <div className="baslik">Hatalarım</div>

        {yukleniyor ? (
          <div className="kart alt-yazi" style={{ textAlign: "center", padding: 22 }}>
            Yükleniyor…
          </div>
        ) : bos ? (
          <div className="kart bd-calisma-bos">
            <Maskot poz="dusunuyor" boyut={72} />
            <div className="bd-calisma-bos-metin">
              Henüz yanlışın yok — maç yaptıkça burada birikecek.
              <br />
              Yine de genel havuzdan çalışabilirsin.
            </div>
          </div>
        ) : (
          <div className="kart bd-calisma-ozet">
            <div className="bd-calisma-ozet-ust">
              <span>
                Bankanda <b>{banka.bekleyen} soru</b> var
              </span>
              <span className="ayrac">·</span>
              <span>
                <b>{banka.ogrenilen}</b> tanesini öğrendin
              </span>
            </div>
            {banka.kategoriler.length > 0 && (
              <div className="bd-calisma-cubuklar">
                {banka.kategoriler.map((k) => {
                  const enCok = Math.max(...banka.kategoriler.map((x) => x.kategori_adet), 1);
                  return (
                    <div key={k.kategori} className="bd-calisma-cubuk">
                      <span className="ad">{kategoriEtiket(k.kategori)}</span>
                      <span className="iz">
                        <span
                          className="dolgu"
                          style={{ width: `${(k.kategori_adet / enCok) * 100}%` }}
                        />
                      </span>
                      <span className="adet">{k.kategori_adet}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="bd-kat-baslik">
          <span>Kategori</span>
        </div>
        <div className="bd-kat-grid">
          <button
            className={`bd-kat-kart ${kategori === null ? "aktif" : ""}`}
            onClick={() => setKategori(null)}
          >
            <KategoriIkon anahtar="karisik" boyut={24} plaka />
            <span className="bd-kat-ad">Tümü</span>
          </button>
          {kategorileriSirala(kategoriler).map((k) => (
            <button
              key={k.kategori}
              className={`bd-kat-kart ${kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => setKategori(k.kategori)}
            >
              <KategoriIkon anahtar={k.kategori} boyut={24} plaka />
              <span className="bd-kat-ad">{kategoriEtiket(k.kategori)}</span>
            </button>
          ))}
        </div>

        <div className="bd-kat-baslik">
          <span>Soru sayısı</span>
        </div>
        <div className="bd-calisma-adet">
          {SORU_SECENEKLERI.map((n) => (
            <button
              key={n}
              className={`bd-calisma-adet-btn ${soruSayisi === n ? "aktif" : ""}`}
              onClick={() => setSoruSayisi(n)}
            >
              {n}
            </button>
          ))}
        </div>

        {hata && <div className="hata-kutu">{hata}</div>}
        <button className="bd-ana-eylem" onClick={basla} disabled={calisiyor}>
          <Ikon ad="kitap" boyut={22} />
          <span>{calisiyor ? "Hazırlanıyor…" : "Çalışmaya başla"}</span>
        </button>
      </div>
    );
  }

  // ============ OYUN EKRANI ============
  if (asama === "oyun") {
    const secenekler = soru
      ? Array.isArray(soru.secenekler)
        ? soru.secenekler
        : JSON.parse(soru.secenekler)
      : [];
    const toplam = soru?.toplam ?? oturum?.soru_sayisi ?? 0;
    const sirada = (soru?.soru_index ?? 0) + 1;
    const oran = toplam > 0 ? (sirada / toplam) * 100 : 0;

    // Cevap sonrası kısa geri bildirim
    let geriBildirim = null;
    if (sonucSoru) {
      if (sonucSoru.ogrenildi) {
        geriBildirim = { tip: "ogrenildi", metin: "Öğrenildi! Bankadan çıktı" };
      } else if (sonucSoru.dogru && sonucSoru.bankadan) {
        geriBildirim = {
          tip: "iyi",
          metin: `${sonucSoru.yeni_seri}/2 doğru — bir kez daha bilirsen öğrenilmiş sayılacak`,
        };
      } else if (sonucSoru.dogru) {
        geriBildirim = { tip: "iyi", metin: "Doğru" };
      } else if (sonucSoru.bankadan) {
        geriBildirim = {
          tip: "uyari",
          metin: `Bunu daha önce ${Math.max(1, (sonucSoru.onceki_yanlis ?? 1) - 1)} kez yanlış bilmiştin`,
        };
      } else {
        geriBildirim = { tip: "uyari", metin: "Yanlış — Hatalarım'a eklendi" };
      }
    }

    return (
      <div className="bd-calisma-oyun">
        <Konfeti aktif={kutlama} />

        {/* Bu modun puansız olduğu her an görünür */}
        <div className="bd-calisma-serit">
          <Ikon ad="kitap" boyut={14} />
          <span>ÇALIŞMA · PUAN VERİLMEZ</span>
        </div>

        <div className="bd-calisma-ilerleme">
          <div className="iz">
            <div className="dolgu" style={{ width: `${oran}%` }} />
          </div>
          <span className="bd-calisma-kalan">
            {sirada}/{toplam} · {Math.max(0, toplam - sirada)} soru kaldı
          </span>
        </div>

        {soru && (
          <>
            <div className="bd-calisma-ust">
              <span className="bd-calisma-kat">
                <KategoriIkon anahtar={soru.kategori} boyut={16} />
                {kategoriEtiket(soru.kategori)}
              </span>
              {soru.bankadan && (
                <span className="bd-calisma-rozet">
                  {soru.onceki_yanlis} kez yanlış
                </span>
              )}
              <span className={`bd-calisma-sn ${kalan <= 3 ? "kritik" : ""}`}>
                {Math.ceil(kalan)} sn
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

            {geriBildirim && (
              <div className={`bd-calisma-geri ${geriBildirim.tip}`}>
                {geriBildirim.metin}
              </div>
            )}
          </>
        )}
        {hata && <div className="hata-kutu">{hata}</div>}
      </div>
    );
  }

  // ============ SONUÇ EKRANI ============
  const ogrenilen = sonuc?.ogrenilen ?? 0;
  return (
    <div>
      <div className="kart bd-calisma-sonuc">
        <div className="bd-calisma-serit ic">
          <Ikon ad="kitap" boyut={14} />
          <span>ÇALIŞMA · PUAN VERİLMEZ</span>
        </div>

        <div className="bd-calisma-buyuk">{ogrenilen}</div>
        <div className="alt-yazi">soru öğrenildi</div>

        <div className="bd-hizli-ozet" style={{ marginTop: 14 }}>
          <div>
            <b>{sonuc?.dogru ?? 0}</b>
            <span>doğru</span>
          </div>
          <div>
            <b>{sonuc?.yanlis ?? 0}</b>
            <span>yanlış</span>
          </div>
          <div>
            <b>{sonuc?.bankada_kalan ?? 0}</b>
            <span>bankada</span>
          </div>
        </div>

        <div className="bd-calisma-toplam">
          Bugüne kadar toplam <b>{sonuc?.toplam_ogrenilen ?? 0}</b> soru öğrendin.
          Doğru cevapların kategori ustalığına işlendi.
        </div>

        <div className="bd-konum-butonlar" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setAsama("secim")}>
            Tekrar çalış
          </button>
          <button className="btn ikincil" onClick={() => navigate("/bildim")}>
            Ana sayfa
          </button>
        </div>
      </div>
      {hata && <div className="hata-kutu">{hata}</div>}
    </div>
  );
}
