// ============================================================
// BİRLEŞİK SIRALAMA — IDA GG Game Center genel puan tablosu (Faz 6).
// Profil ikonundan açılır; tüm oyunların skorunu user_id üzerinden birleştiren
// birlesik_siralama() RPC'sini okur ve oyun bazlı + toplam puanı gösterir.
// ============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

const SUTUNLAR = [
  { key: "bildim", ad: "Quiz Square", ikon: "🧠" },
  { key: "kafatopu", ad: "Kafa Topu", ikon: "⚽" },
  { key: "driftgp", ad: "DidaGP", ikon: "🏎️" },
  { key: "meyvekes", ad: "Meyve Kes", ikon: "🍉" },
  { key: "patirun", ad: "PatiRun", ikon: "🐾" },
];

export default function BirlesikSiralama() {
  const { user } = useAuth();
  const [satirlar, setSatirlar] = useState([]);
  const [durum, setDurum] = useState("yukleniyor"); // yukleniyor | hazir | hata
  const [hata, setHata] = useState("");

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("birlesik_siralama");
        if (error) throw error;
        if (iptal) return;
        setSatirlar(data || []);
        setDurum("hazir");
      } catch (e) {
        if (iptal) return;
        console.error("Birleşik sıralama hatası:", e);
        setHata(e?.message || "Sıralama yüklenemedi.");
        setDurum("hata");
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  return (
    <div className="gc-root">
      <div className="gc-arka" aria-hidden="true" />

      <header className="gc-header">
        <Link to="/" className="gc-brand" style={{ textDecoration: "none" }}>
          <span className="gc-brand-mark">←</span>
          <div className="gc-brand-text">
            <span className="gc-brand-name">Genel Sıralama</span>
            <span className="gc-brand-sub">TÜM OYUNLAR</span>
          </div>
        </Link>
      </header>

      <section className="gc-hero" style={{ paddingBottom: 8 }}>
        <h1 className="gc-hero-baslik">🏆 Birleşik Puan Tablosu</h1>
        <p className="gc-hero-alt">Her oyuncunun oyun bazlı ve toplam puanı.</p>
      </section>

      <section className="gc-bolum">
        {durum === "yukleniyor" && <p className="sr-bilgi">Yükleniyor…</p>}
        {durum === "hata" && (
          <p className="sr-bilgi sr-hata">
            ⚠️ {hata}
            <br />
            <small>(Migration'lar uygulanmamış olabilir — birlesik_siralama RPC'si gerekli.)</small>
          </p>
        )}
        {durum === "hazir" && satirlar.length === 0 && <p className="sr-bilgi">Henüz sıralama verisi yok.</p>}

        {durum === "hazir" && satirlar.length > 0 && (
          <div className="sr-tablo-sar">
            <table className="sr-tablo">
              <thead>
                <tr>
                  <th className="sr-sira">#</th>
                  <th className="sr-oyuncu">Oyuncu</th>
                  {SUTUNLAR.map((s) => (
                    <th key={s.key} className="sr-oyun" title={s.ad}>
                      <span className="sr-oyun-ikon">{s.ikon}</span>
                    </th>
                  ))}
                  <th className="sr-toplam">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((r, i) => (
                  <tr key={r.user_id} className={r.user_id === user?.id ? "sr-ben" : ""}>
                    <td className="sr-sira">{i + 1}</td>
                    <td className="sr-oyuncu">
                      <div className="sr-oyuncu-hucre">
                        <Avatar profile={{ gorunen_ad: r.gorunen_ad, gorunen_avatar: r.gorunen_avatar }} boyut={30} />
                        <span className="sr-ad">{r.gorunen_ad}</span>
                      </div>
                    </td>
                    {SUTUNLAR.map((s) => (
                      <td key={s.key} className="sr-oyun">
                        {r[s.key] ? r[s.key].toLocaleString("tr-TR") : "–"}
                      </td>
                    ))}
                    <td className="sr-toplam">{(r.toplam || 0).toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="gc-footer">Quiz Square · Genel sıralama 🚀</footer>
    </div>
  );
}
