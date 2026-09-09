import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { kategoriEtiket } from "../lib/kategoriler.js";
import Maskot from "./Maskot.jsx";

const BEKLEME_SN = 8; // bu süre içinde insan rakip aranır, sonra bota düşülür

/**
 * "Hemen Oyna" eşleştirme ekranı.
 * Tam ekran katman olarak `document.body`'ye portal ile basılır — daha önce
 * ana sayfanın içinde konumlandığı için hiç görünmüyordu.
 *
 * Akış: kuyruğa gir → 8 sn insan rakip ara → bulunamazsa bota düş ve bunu
 * ekranda söyle. Rakip bulununca 1 sn "Rakip bulundu: X" gösterilip maça geçilir.
 */
export default function RakipAra({ kategori, onBulundu, onIptal }) {
  const { user } = useAuth();
  const [kalan, setKalan] = useState(BEKLEME_SN);
  const [hata, setHata] = useState(null);
  const [botaDusuldu, setBotaDusuldu] = useState(false);
  const [rakipAdi, setRakipAdi] = useState(null);
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

  // Maça geçmeden önce rakibin adını 1 sn göster
  const bitir = useCallback(
    async (macId) => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      clearInterval(zamanlayiciRef.current);
      try {
        const { data } = await supabase
          .from("matches")
          .select(
            `oyuncu1, oyuncu2,
             p1:profiles!matches_oyuncu1_fkey(gorunen_ad),
             p2:profiles!matches_oyuncu2_fkey(gorunen_ad)`
          )
          .eq("id", macId)
          .maybeSingle();
        if (data) {
          const rakip = data.oyuncu1 === user?.id ? data.p2 : data.p1;
          setRakipAdi(rakip?.gorunen_ad ?? null);
        }
      } catch {
        /* ad alınamadı — yine de maça geç */
      }
      window.setTimeout(() => onBulundu(macId), 1000);
    },
    [onBulundu, user?.id]
  );

  // Son çare: bot/karışık maç
  const sonCare = useCallback(async () => {
    if (bittiRef.current) return;
    setBotaDusuldu(true);
    clearInterval(zamanlayiciRef.current);
    try {
      await supabase.rpc("kuyruktan_cik");
    } catch {
      /* önemli değil */
    }
    try {
      const { data, error } = await supabase.rpc("quick_match", {
        p_kategori: kategori ?? null,
      });
      if (error) throw error;
      if (data) bitir(data);
    } catch (e) {
      setHata("Maç başlatılamadı. Bağlantını kontrol edip tekrar dene.");
      console.error("[Bildim] quick_match:", e);
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
        setHata("Rakip aranamadı. Bağlantını kontrol edip tekrar dene.");
        console.error("[Bildim] kuyruga_gir:", e);
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
        dene(); // her saniye kuyruğu yokla (8 sn kısa, sık bakmak gerek)
        return yeni;
      });
    }, 1000);

    return () => {
      iptal = true;
      clearInterval(zamanlayiciRef.current);
      if (!bittiRef.current) supabase.rpc("kuyruktan_cik").catch(() => {});
    };
  }, [kategori, bitir, sonCare]);

  const govde = (
    <div className="bd-arama-katman" role="dialog" aria-modal="true" aria-label="Rakip aranıyor">
      <div className="bd-arama-kutu">
        <div className="bd-arama-halka" aria-hidden="true">
          <Maskot poz={rakipAdi ? "kutluyor" : "dusunuyor"} boyut={84} />
        </div>

        {rakipAdi ? (
          <div className="bd-arama-bulundu">Rakip bulundu: {rakipAdi}</div>
        ) : (
          <div className="bd-arama-baslik">
            {botaDusuldu ? "Maç hazırlanıyor…" : "Rakip aranıyor…"}
          </div>
        )}

        <div className="bd-arama-alt">
          {kategori ? kategoriEtiket(kategori) : "Karışık"} kategorisinde
          {botaDusuldu
            ? " uygun rakip bulunamadı — BilgeBot ile oynuyorsun."
            : " seninle aynı seviyede birini arıyoruz."}
        </div>

        {!botaDusuldu && !rakipAdi && (
          <div className="bd-arama-sayac">{kalan} sn</div>
        )}

        {hata && <div className="hata-kutu">{hata}</div>}

        {!rakipAdi && (
          <div className="bd-arama-eylem">
            {!botaDusuldu && (
              <button className="btn" onClick={sonCare}>
                Bot ile hemen oyna
              </button>
            )}
            <button
              className="btn ikincil"
              onClick={async () => {
                await temizle();
                onIptal();
              }}
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Sayfa içindeki yığılma bağlamına takılmasın diye doğrudan body'ye
  return typeof document === "undefined" ? govde : createPortal(govde, document.body);
}
