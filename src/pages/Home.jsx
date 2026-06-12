import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import Avatar from "../components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";

export default function Home() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [lobide, setLobide] = useState(false);
  const [lobiSayisi, setLobiSayisi] = useState(0);
  const [canliTurnuva, setCanliTurnuva] = useState(false);
  const [top5, setTop5] = useState([]);
  const [mesaj, setMesaj] = useState(null);

  useEffect(() => {
    const yukle = async () => {
      const { data: tlar } = await supabase
        .from("tournaments")
        .select("id, durum, tarih")
        .order("tarih", { ascending: false })
        .limit(2);

      const aktif = (tlar ?? []).find((t) => t.durum === "aktif");
      setCanliTurnuva(Boolean(aktif));

      const lobi = (tlar ?? []).find((t) => t.durum === "lobi");
      if (lobi) {
        const { data: oyuncular, count } = await supabase
          .from("tournament_players")
          .select("user_id", { count: "exact" })
          .eq("tournament_id", lobi.id);
        setLobiSayisi(count ?? 0);
        setLobide((oyuncular ?? []).some((o) => o.user_id === user.id));
      }

      const { data: liderler } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, puan")
        .order("puan", { ascending: false })
        .limit(5);
      setTop5(liderler ?? []);
    };
    yukle();
  }, [user]);

  const lobiyeKatil = async () => {
    setMesaj(null);
    const { error } = await supabase.rpc("join_tournament_lobby");
    if (error) setMesaj(error.message);
    else {
      setLobide(true);
      setLobiSayisi((n) => n + 1);
    }
  };

  const hemenOyna = async () => {
    setMesaj(null);
    const { data, error } = await supabase.rpc("quick_match");
    if (error) setMesaj(error.message);
    else if (data) navigate(`/mac/${data}`);
  };

  return (
    <div>
      <div className="geri-sayim-kart">
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
          🌙 GECE TURNUVASI
        </div>
        {canliTurnuva ? (
          <>
            <h2 style={{ margin: "12px 0" }}>
              <span className="canli-nokta" />
              Turnuva ŞU AN canlı!
            </h2>
            <button className="btn" onClick={() => navigate("/turnuva")}>
              İzle / Oyna →
            </button>
          </>
        ) : (
          <>
            <Countdown />
            <div className="alt-yazi" style={{ marginBottom: 14 }}>
              Her gece 22:00'de başlar · Son kalan kazanır · 🏆 +250 puan
            </div>
            {mesaj && <div className="hata-kutu">{mesaj}</div>}
            {lobide ? (
              <button className="btn ikincil" onClick={() => navigate("/turnuva")}>
                ✅ Lobidesin ({lobiSayisi} oyuncu) — Lobiye git
              </button>
            ) : (
              <button className="btn" onClick={lobiyeKatil}>
                🎟️ Lobiye Katıl {lobiSayisi > 0 && `(${lobiSayisi} oyuncu bekliyor)`}
              </button>
            )}
          </>
        )}
      </div>

      <button className="btn" style={{ marginBottom: 14, padding: "16px 20px", fontSize: 17 }} onClick={hemenOyna}>
        ⚡ Hemen Oyna
      </button>

      <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar profile={profile} boyut={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {profile?.username}
            {(profile?.seri ?? 0) > 0 && (
              <span className="rutbe-chip" style={{ marginLeft: 8, color: "var(--accent)" }}>
                🔥 {profile.seri} gün
              </span>
            )}
          </div>
          <RankBadge puan={profile?.puan} />
        </div>
        <Link to="/meydan">
          <button className="btn kucuk">⚔️ Meydan Oku</button>
        </Link>
      </div>

      <div className="kart">
        <div className="baslik">🔥 En İyiler</div>
        {top5.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
            <span className={`sira-no ${i < 3 ? "ilk3" : ""}`}>{i + 1}</span>
            <Avatar profile={p} boyut={32} />
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{p.username}</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>⭐ {p.puan}</span>
          </div>
        ))}
        <Link to="/siralama" className="alt-yazi" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
          Tüm sıralamayı gör →
        </Link>
      </div>
    </div>
  );
}
