// ============================================================
// GÖLGE BOKS — sıralama (mod bazlı + sezon ligi)
// Mod bazlı ayrı listeler: Serbest/Koç/Savunma/Ritim aynı ölçekte değildir,
// tek listede birleştirmek adaletsiz olurdu. Sezon sekmesi aylık sıfırlanan
// lig puanını gösterir (hub'daki dönemsel sistemle aynı mantık).
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../../src/components/Avatar.jsx";
import { useBoks } from "../BoksApp.jsx";
import { siralamaGetir, sezonSiralamaGetir } from "../../lib/depo.js";
import { MODLAR } from "../../engine/oyun.js";

export default function SiralamaPage() {
  const { user } = useBoks();
  const [sekme, setSekme] = useState("serbest"); // mod kodu veya 'sezon'
  const [liste, setListe] = useState([]);
  const [durum, setDurum] = useState("yukleniyor");

  const yukle = useCallback(async (s) => {
    setDurum("yukleniyor");
    try {
      const veri = s === "sezon" ? await sezonSiralamaGetir() : await siralamaGetir(s);
      setListe(veri);
      setDurum("hazir");
    } catch (e) {
      console.error("[Boks] Sıralama hatası:", e);
      setDurum("hata");
    }
  }, []);

  useEffect(() => {
    yukle(sekme);
  }, [sekme, yukle]);

  const sezon = sekme === "sezon";

  return (
    <div className="bx-sayfa">
      <div className="bx-sayfa-ust">
        <Link to="/boks" className="bx-geri">← Menü</Link>
        <h2>🏆 Sıralama</h2>
      </div>

      <div className="bx-sekmeler">
        {Object.entries(MODLAR).map(([k, m]) => (
          <button key={k} className={sekme === k ? "aktif" : ""} onClick={() => setSekme(k)}>
            {m.ikon} {m.ad}
          </button>
        ))}
        <button className={sezon ? "aktif" : ""} onClick={() => setSekme("sezon")}>
          🗓️ Sezon
        </button>
      </div>

      {sezon && (
        <p className="bx-not">
          Sezon puanı her ay sıfırlanır; tüm modlarda kazandığın puan toplanır.
        </p>
      )}

      {durum === "yukleniyor" && <div className="bx-bos">Yükleniyor…</div>}
      {durum === "hata" && <div className="bx-bos">Sıralama yüklenemedi.</div>}
      {durum === "hazir" && liste.length === 0 && (
        <div className="bx-bos">Henüz skor yok. İlk sen ol! 🥊</div>
      )}

      {durum === "hazir" && liste.length > 0 && (
        <ol className="bx-siralama">
          {liste.map((s, i) => (
            <li key={s.user_id} className={s.user_id === user.id ? "ben" : ""}>
              <span className={"bx-sira " + (i < 3 ? "podyum p" + (i + 1) : "")}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <Avatar profile={{ username: s.username, avatar_url: s.avatar_url }} boyut={38} />
              <span className="bx-ad">{s.username || "Oyuncu"}</span>
              <span className="bx-deger">
                {sezon ? s.puan : s.en_iyi}
                {!sezon && s.toplam_yumruk ? <small>{s.toplam_yumruk} yumruk</small> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
