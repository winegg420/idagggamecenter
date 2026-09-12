// ============================================================
// OYUNCU KARTI — listelerde bir isme dokununca açılan kart
//
// Lig tablosu ve turnuva lobisinde oyuncular sadece bir satırdı: kim olduğunu
// görmek, avatarına bakmak ya da oradan meydan okumak mümkün değildi.
// Artık satıra dokunmak bu kartı açıyor.
//
// Veri doğrudan `profiles`ten okunuyor (RLS'te select politikası herkese
// açık); yalnız HERKESE AÇIK alanlar gösteriliyor — gerçek ad, e-posta ve
// konum ayarları burada YOK.
// ============================================================
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import AvatarCerceve from "./AvatarCerceve.jsx";
import Modal from "./Modal.jsx";
import Ikon from "./Ikon.jsx";
import RankBadge from "./RankBadge.jsx";
import { hataMesaji } from "../lib/hata.js";
import { bayrak } from "../lib/konum.js";

const ALANLAR =
  // `is_bot` BİLEREK YOK: gizli botlar gerçek oyuncudan ayırt edilmemeli
  // (kolon `authenticated` rolüne kapalı, bkz. migration 155). İstemci
  // yalnız `acik_bot` görür — adında "Bot" geçen, zaten belli olan botlar.
  "id, gorunen_ad, gorunen_avatar, puan, sampiyonluk, toplam_mac, sehir, ulke, acik_bot, last_seen, seri_gun";

/**
 * @param {object} o
 * @param {string} o.userId       kartı açılacak oyuncu
 * @param {object} [o.onIzleme]   listede elimizde olan bilgi (kart boş açılmasın)
 * @param {() => void} o.onKapat
 * @param {(id:string) => void} [o.onMeydanOku]  verilmezse düğme çizilmez
 */
export default function OyuncuKarti({ userId, onIzleme = null, onKapat, onMeydanOku }) {
  const [p, setP] = useState(onIzleme);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(ALANLAR)
          .eq("id", userId)
          .single();
        if (error) throw error;
        if (aktif && data) setP(data);
      } catch (e) {
        // Önizleme varsa kart yine de dolu görünür; sessiz kalmıyoruz.
        console.error("[Bildim] oyuncu karti alinamadi:", e);
        if (aktif && !onIzleme) setHata(hataMesaji(e, "Oyuncu bilgisi alınamadı."));
      } finally {
        if (aktif) setYukleniyor(false);
      }
    })();
    return () => { aktif = false; };
  }, [userId, onIzleme]);

  const online = p?.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000;

  return (
    <Modal onKapat={onKapat} etiket="Oyuncu kartı">
      <div className="bd-modal bd-oyuncu-karti">
        <button type="button" className="bd-oyuncu-kapat" onClick={onKapat} aria-label="Kapat">✕</button>

        <div className="bd-oyuncu-ust">
          <div className="bd-oyuncu-avatar">
            <AvatarCerceve profile={p ?? {}} boyut={96} userId={userId} />
            {online && <span className="bd-oyuncu-online" title="Şu an oyunda" />}
          </div>
          <div className="bd-oyuncu-ad">
            {p?.gorunen_ad ?? (yukleniyor ? "…" : "Oyuncu")}
            {(p?.acik_bot ?? p?.is_bot) && (
              <span className="bd-bot-rozet" title="Yapay rakip"><Ikon ad="robot" boyut={13} /></span>
            )}
          </div>
          {p && <RankBadge puan={p.puan ?? 0} />}
          {p?.ulke && (
            <div className="bd-oyuncu-konum">{bayrak(p.ulke)} {p.sehir ?? ""}</div>
          )}
        </div>

        {hata && <div className="hata-kutu">{hata}</div>}

        <div className="bd-oyuncu-sayilar">
          <div><b>{Number(p?.puan ?? 0).toLocaleString("tr-TR")}</b><span>puan</span></div>
          <div><b>{Number(p?.toplam_mac ?? 0).toLocaleString("tr-TR")}</b><span>maç</span></div>
          <div><b>{Number(p?.sampiyonluk ?? 0).toLocaleString("tr-TR")}</b><span>kupa</span></div>
          <div><b>{Number(p?.seri_gun ?? 0).toLocaleString("tr-TR")}</b><span>gün seri</span></div>
        </div>

        {onMeydanOku && (
          <button type="button" className="btn" onClick={() => onMeydanOku(userId)}>
            <Ikon ad="kilic" boyut={16} /> Meydan oku
          </button>
        )}
      </div>
    </Modal>
  );
}
