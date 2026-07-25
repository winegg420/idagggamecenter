// MEYVE KES — sıralama (tekli / arkadaşla ayrı listeler).
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import Avatar from "../../../src/components/Avatar.jsx";
import { useMK } from "../MeyveKesApp.jsx";

export default function SiralamaPage() {
  const { user } = useMK();
  const [mod, setMod] = useState("tekli");
  const [liste, setListe] = useState([]);
  const [durum, setDurum] = useState("yukleniyor"); // yukleniyor | hazir | hata

  const yukle = useCallback(async (m) => {
    setDurum("yukleniyor");
    try {
      const { data, error } = await supabase.rpc("meyvekes_siralama", { p_mod: m });
      if (error) throw error;
      setListe(data || []);
      setDurum("hazir");
    } catch (e) {
      console.error("Meyve Kes sıralama hatası:", e);
      setDurum("hata");
    }
  }, []);

  useEffect(() => {
    yukle(mod);
  }, [mod, yukle]);

  return (
    <div className="mk-siralama">
      <div className="mk-siralama-ust">
        <Link to="/meyvekes" className="mk-geri">← Menü</Link>
        <h2>🏆 Sıralama</h2>
      </div>

      <div className="mk-mod-sekme">
        <button className={mod === "tekli" ? "aktif" : ""} onClick={() => setMod("tekli")}>Tekli</button>
        <button className={mod === "arkadas" ? "aktif" : ""} onClick={() => setMod("arkadas")}>Arkadaşla</button>
        <button className={mod === "yeme" ? "aktif" : ""} onClick={() => setMod("yeme")}>Meyve Ye</button>
      </div>

      {durum === "yukleniyor" && <div className="mk-bilgi">Yükleniyor…</div>}
      {durum === "hata" && <div className="mk-bilgi">Sıralama yüklenemedi.</div>}
      {durum === "hazir" && liste.length === 0 && (
        <div className="mk-bilgi">Henüz skor yok. İlk sen ol! 🍉</div>
      )}

      {durum === "hazir" && liste.length > 0 && (
        <ol className="mk-siralama-liste">
          {liste.map((s, i) => (
            <li key={s.user_id} className={s.user_id === user.id ? "ben" : ""}>
              <span className={"mk-sira " + (i < 3 ? "podyum p" + (i + 1) : "")}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <Avatar profile={{ username: s.username, avatar_url: s.avatar_url }} boyut={38} />
              <span className="mk-ad">{s.username || "Oyuncu"}</span>
              <span className="mk-en-iyi">{s.en_iyi}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
