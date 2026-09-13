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
 * Akış: kuyruğa gir → 8 sn gerçek rakip ara → bulunamazsa sunucu bir rakip
 * kurar. Rakip bulununca 1 sn "Rakip bulundu: X" gösterilip maça geçilir.
 *
 * Beklemek istemeyen "Beklemeden bot ile oyna"ya basar: seviyesine yakın
 * bir AÇIK botla anında eşleşir (migration 177 › hemen_bot_mac).
 *
 * Otomatik yolda ekranda "bot" kelimesi GEÇMEZ: gizli botlar gerçek
 * oyuncu gibi görünmeli (bkz. migration 155). Açık bot yolunda geçer —
 * oyuncu bilerek seçiyor ve o maçta coin yarıya iniyor.
 */
export default function RakipAra({ kategori, dereceli = true, onBulundu, onIptal }) {
  const { user } = useAuth();
  const [kalan, setKalan] = useState(BEKLEME_SN);
  const [hata, setHata] = useState(null);
  const [botaDusuldu, setBotaDusuldu] = useState(false);
  // Açık bot yolu ayrı tutulur: ekrandaki yazı dürüst olsun (o maçta coin yarıya iner).
  const [botYolu, setBotYolu] = useState(false);
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
        const { data, error } = await supabase
          .from("matches")
          .select(
            `oyuncu1, oyuncu2,
             p1:profiles!matches_oyuncu1_fkey(gorunen_ad),
             p2:profiles!matches_oyuncu2_fkey(gorunen_ad)`
          )
          .eq("id", macId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const rakip = data.oyuncu1 === user?.id ? data.p2 : data.p1;
          setRakipAdi(rakip?.gorunen_ad ?? null);
        }
      } catch (e) {
        // Ad alınamadı — maça yine de geçilir, ama sebep sessizce yutulmasın.
        console.error("[Bildim] rakip adı alınamadı:", e);
      }
      window.setTimeout(() => onBulundu(macId), 1000);
    },
    [onBulundu, user?.id]
  );

  // SABIRSIZ TIKLAMA: oyuncu beklemek istemiyorsa seviyesine yakın bir
  // AÇIK bot ile ANINDA eşleşir (ToyBot / ÇaylakBot / ÜstatBot /
  // EfsaneBot). Burada "bot" kelimesi bilerek geçer: açık botlar zaten
  // adından belli ve oyuncu bilerek seçiyor. Gizli botlar bu yola
  // KARIŞMAZ — onların gizli kalması gerekiyor.
  const hemenBot = useCallback(async () => {
    if (bittiRef.current) return;
    setBotaDusuldu(true);
    setBotYolu(true);
    clearInterval(zamanlayiciRef.current);
    try {
      const { data, error } = await supabase.rpc("hemen_bot_mac", {
        p_kategori: kategori ?? null,
        p_dereceli: dereceli,
      });
      if (error) throw error;
      if (data) { bitir(data); return; }
      setHata("Şu an uygun rakip bulunamadı. Birazdan tekrar dene.");
    } catch (e) {
      setHata("Maç başlatılamadı. Bağlantını kontrol edip tekrar dene.");
      console.error("[Bildim] hemen_bot_mac:", e);
    }
  }, [kategori, dereceli, bitir]);

  // Son çare: 8 sn dolunca sunucu rakip kursun.
  //
  // `quick_match` BOŞ dönebilir: sunucu, gerçekten aranmış gibi görünsün
  // diye botu kurmadan önce 2-5 sn bekletiyor (bkz. migration 155). Bu
  // yüzden tek seferlik değil, id gelene kadar saniyede bir yokluyoruz.
  // Bu yolda ekranda "bot" kelimesi GEÇMEZ — gizli botun gizli kalması bu
  // ekrandan başlıyor.
  const sonCare = useCallback(async () => {
    if (bittiRef.current) return;
    setBotaDusuldu(true);
    clearInterval(zamanlayiciRef.current);

    const dene = async () => {
      if (bittiRef.current) return true;
      try {
        const { data, error } = await supabase.rpc("quick_match", {
          p_kategori: kategori ?? null,
          p_dereceli: dereceli,
        });
        if (error) throw error;
        if (data) { bitir(data); return true; }
        return false;                       // sunucu hâlâ arıyor
      } catch (e) {
        setHata("Maç başlatılamadı. Bağlantını kontrol edip tekrar dene.");
        console.error("[Bildim] quick_match:", e);
        return true;                        // hata: yoklamayı durdur
      }
    };

    if (await dene()) return;
    zamanlayiciRef.current = setInterval(async () => {
      if (await dene()) clearInterval(zamanlayiciRef.current);
    }, 1000);
  }, [kategori, dereceli, bitir]);

  useEffect(() => {
    let iptal = false;

    const dene = async () => {
      if (iptal || bittiRef.current) return;
      try {
        const { data, error } = await supabase.rpc("kuyruga_gir", {
          p_kategori: kategori ?? null,
          p_dereceli: dereceli,
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
      // supabase.rpc() bir PostgrestFilterBuilder döndürür: thenable ama Promise
      // DEĞİL, .catch() metodu yok. Doğrudan .catch çağrısı TypeError atıp
      // ekranı boş bırakıyordu. then'in ikinci argümanı hatayı güvenle yutar.
      if (!bittiRef.current) supabase.rpc("kuyruktan_cik").then(() => {}, () => {});
    };
  }, [kategori, dereceli, bitir, sonCare]);

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
          {botYolu
            ? " seviyene yakın bir botla eşleştiriyoruz. Bot maçında coin ödülü yarıya iner."
            : botaDusuldu
              ? " seviyene yakın bir rakiple eşleştiriyoruz."
              : " seninle aynı seviyede birini arıyoruz."}
        </div>

        {!botaDusuldu && !rakipAdi && (
          <div className="bd-arama-sayac">{kalan} sn</div>
        )}

        {hata && <div className="hata-kutu">{hata}</div>}

        {!rakipAdi && (
          <div className="bd-arama-eylem">
            {!botaDusuldu && (
              <button className="btn" onClick={hemenBot}>
                Beklemeden bot ile oyna
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
