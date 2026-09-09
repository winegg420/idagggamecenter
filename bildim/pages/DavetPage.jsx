import { useEffect, useRef, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { y } from "../lib/yol.js";

const DEPO_ANAHTAR = "bildim_davet_kodu";

/**
 * /bildim/davet/:kod — davet linkiyle arkadaş ekleme.
 * Giriş yoksa kod hatırlanır; kullanıcı giriş yapınca otomatik istek gönderilir
 * (bkz. AuthContext oturum açılışında da aynı anahtar okunur).
 */
export default function DavetPage() {
  const { kod } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [durum, setDurum] = useState("bekliyor"); // bekliyor | basarili | hata
  const [mesaj, setMesaj] = useState("Davet işleniyor…");
  const calistiRef = useRef(false);

  useEffect(() => {
    const temiz = (kod ?? "").trim().toUpperCase();

    if (!temiz || temiz.length !== 8) {
      setDurum("hata");
      setMesaj("Bu davet linki geçersiz görünüyor.");
      return;
    }

    // Giriş yoksa kodu sakla; giriş sonrası burada tekrar denenecek
    if (!user) {
      try {
        localStorage.setItem(DEPO_ANAHTAR, temiz);
      } catch {
        /* özel mod */
      }
      setMesaj("Devam etmek için giriş yapman gerekiyor…");
      return;
    }

    // Kurulum (takma ad/avatar/şehir) bitmeden istek göndermeyelim;
    // Layout zaten sihirbazı gösteriyor, biz bekleyelim.
    if (profile && (!profile.takma_ad_secildi || !profile.ulke)) {
      setMesaj("Önce profilini tamamla, sonra davet otomatik uygulanacak.");
      try {
        localStorage.setItem(DEPO_ANAHTAR, temiz);
      } catch {
        /* özel mod */
      }
      return;
    }

    if (calistiRef.current) return;
    calistiRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("arkadas_davet_kodu_ile_ekle", {
          p_kod: temiz,
        });
        if (error) throw error;
        const sonuc = Array.isArray(data) ? data[0] : data;
        const ad = sonuc?.gorunen_ad ?? "Oyuncu";
        const mesajlar = {
          istek_gonderildi: `${ad} kişisine arkadaşlık isteği gönderildi`,
          arkadas_oldu: `${ad} artık arkadaşın!`,
          zaten_arkadas: `${ad} zaten arkadaşın.`,
        };
        setDurum("basarili");
        setMesaj(mesajlar[sonuc?.durum] ?? "İstek gönderildi");
        try {
          localStorage.removeItem(DEPO_ANAHTAR);
        } catch {
          /* özel mod */
        }
        setTimeout(() => navigate(y("/arkadaslar")), 1800);
      } catch (e) {
        setDurum("hata");
        setMesaj(hataMesaji(e, "Davet uygulanamadı."));
      }
    })();
  }, [kod, user, profile, navigate]);

  return (
    <div className="kart bd-davet-sonuc">
      <div style={{ fontSize: 40, marginBottom: 10 }}>
        <Ikon ad={durum === "basarili" ? "onay" : durum === "hata" ? "uyari" : "hediye"} boyut={34} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>
        {durum === "basarili" ? "Davet uygulandı" : "Arkadaş daveti"}
      </div>
      <div className="alt-yazi" style={{ marginBottom: 14 }}>{mesaj}</div>
      <button className="btn ikincil" onClick={() => navigate(y("/arkadaslar"))}>
        Arkadaşlara git
      </button>
    </div>
  );
}
