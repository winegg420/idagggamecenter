import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { kategoriEtiket } from "../lib/kategoriler.js";

const BEKLEME_SN = 20; // bu süre içinde aynı kategoride insan rakip aranır

/**
 * "Hemen Oyna" eşleştirme ekranı.
 * Önce oyuncunun tercih ettiği kategoride insan rakip aranır (kuyruga_gir).
 * 20 saniye içinde bulunamazsa karışığa/bota düşülür (quick_match).
 * onBulundu(macId) çağrılır; onIptal ile kullanıcı vazgeçebilir.
 */
export default function RakipAra({ kategori, onBulundu, onIptal }) {
  const [kalan, setKalan] = useState(BEKLEME_SN);
  const [hata, setHata] = useState(null);
  const [botaDusuldu, setBotaDusuldu] = useState(false);
  const bittiRef = useRef(false);
  const zamanlayiciRef = useRef(null);

  const temizle = useCallback(async () => {
    clearInterval(zamanlayiciRef.current);
    try {
      await supabase.rpc("kuyruktan_cik");
    } catch {
      /* ağ hatası — kuyruk kaydı 90 sn'de kendiliğinden düşer */
    }
  }, []);

  const bitir = useCallback(
    (macId) => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      clearInterval(zamanlayiciRef.current);
      onBulundu(macId);
    },
    [onBulundu]
  );

  // Son çare: bot/karışık maç
  const sonCare = useCallback(async () => {
    if (bittiRef.current) return;
    setBotaDusuldu(true);
    try {
      const { data, error } = await supabase.rpc("quick_match", {
        p_kategori: kategori ?? null,
      });
      if (error) throw error;
      if (data) bitir(data);
    } catch (e) {
      setHata(e.message ?? "Maç başlatılamadı.");
      clearInterval(zamanlayiciRef.current);
    }
  }, [kategori, bitir]);

  useEffect(() => {
    let iptal = false;

    const dene = async () => {
      if (iptal || bittiRef.current) return;
      try {
        const { data, error } = await supabase.rpc("kuyruga_gir", {
          p_kategori: kategori ?? null,
        });
        if (error) throw error;
        if (data) bitir(data);
      } catch (e) {
        setHata(e.message ?? "Rakip aranamadı.");
        clearInterval(zamanlayiciRef.current);
      }
    };

    dene();
    zamanlayiciRef.current = setInterval(() => {
      setKalan((k) => {
        const yeni = k - 1;
        if (yeni <= 0) {
          clearInterval(zamanlayiciRef.current);
          sonCare();
          return 0;
        }
        if (yeni % 2 === 0) dene(); // 2 saniyede bir kuyruğu yokla
        return yeni;
      });
    }, 1000);

    return () => {
      iptal = true;
      clearInterval(zamanlayiciRef.current);
      if (!bittiRef.current) supabase.rpc("kuyruktan_cik").catch(() => {});
    };
  }, [kategori, bitir, sonCare]);

  return (
    <div className="bd-modal-katman" role="dialog" aria-modal="true">
      <div className="bd-modal bd-arama">
        <div className="bd-arama-halka" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="bd-konum-baslik">
          {botaDusuldu ? "Maç hazırlanıyor…" : "Rakip aranıyor…"}
        </div>
        <div className="bd-konum-aciklama">
          {kategori ? kategoriEtiket(kategori) : "🎯 Karışık"} kategorisinde
          {botaDusuldu
            ? " uygun rakip bulunamadı, hemen başlıyoruz."
            : ` seninle aynı seviyede birini arıyoruz. ${kalan} sn`}
        </div>

        {!botaDusuldu && (
          <div className="bd-arama-bar">
            <div
              className="dolgu"
              style={{ width: `${((BEKLEME_SN - kalan) / BEKLEME_SN) * 100}%` }}
            />
          </div>
        )}

        {hata && <div className="hata-kutu">{hata}</div>}

        <button
          className="btn ikincil"
          style={{ marginTop: 14 }}
          onClick={async () => {
            await temizle();
            onIptal();
          }}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
