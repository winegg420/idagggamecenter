import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import Avatar from "../components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";
import { pushDestekleniyor, bildirimleriAc } from "../lib/push.js";
import { sonrakiTurnuvaSeans } from "../lib/zaman.js";

export default function Home() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [adDuzenle, setAdDuzenle] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [adHata, setAdHata] = useState(null);
  const [lobide, setLobide] = useState(false);
  const [lobiSayisi, setLobiSayisi] = useState(0);
  const [canliTurnuva, setCanliTurnuva] = useState(false);
  const [top5, setTop5] = useState([]);
  const [mesaj, setMesaj] = useState(null);
  const [bildirimSor, setBildirimSor] = useState(false);
  const [gorevler, setGorevler] = useState([]);

  const gorevleriYukle = useCallback(() => {
    supabase.rpc("get_daily_quests").then(({ data }) => setGorevler(data ?? []));
  }, []);

  useEffect(() => {
    gorevleriYukle();
  }, [gorevleriYukle]);

  const odulAl = async (questId) => {
    const { error } = await supabase.rpc("claim_quest", { p_quest_id: questId });
    if (!error) {
      gorevleriYukle();
      refreshProfile(user.id);
    }
  };

  useEffect(() => {
    if (
      pushDestekleniyor() &&
      Notification.permission === "default" &&
      !localStorage.getItem("bildim_bildirim_sorma")
    ) {
      setBildirimSor(true);
    }
  }, []);

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

  const adKaydet = async () => {
    setAdHata(null);
    const ad = yeniAd.trim();
    if (ad.length < 3) {
      setAdHata("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ username: ad })
      .eq("id", user.id);
    if (error) {
      setAdHata(error.code === "23505" ? "Bu kullanıcı adı alınmış." : error.message);
    } else {
      setAdDuzenle(false);
      refreshProfile(user.id);
    }
  };

  return (
    <div>
      {bildirimSor && (
        <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1, fontSize: 13 }}>
            Turnuva başlarken haber verelim mi?
          </div>
          <button
            className="btn kucuk"
            onClick={async () => {
              try {
                await bildirimleriAc();
              } catch { /* reddetti */ }
              setBildirimSor(false);
            }}
          >
            Aç
          </button>
          <button
            className="btn kucuk ikincil"
            onClick={() => {
              localStorage.setItem("bildim_bildirim_sorma", "1");
              setBildirimSor(false);
            }}
          >
            Sonra
          </button>
        </div>
      )}

      <div className="geri-sayim-kart">
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
          {sonrakiTurnuvaSeans() === "sabah" ? "☀️ SABAH TURNUVASI" : "🌙 GECE TURNUVASI"}
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
              Her gün 10:00 ve 22:00'de · Son kalan kazanır · 🏆 +250 puan
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
        <div style={{ flex: 1, minWidth: 0 }}>
          {adDuzenle ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={yeniAd}
                  maxLength={24}
                  autoFocus
                  onChange={(e) => setYeniAd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adKaydet()}
                  style={{ padding: "8px 10px", fontSize: 15 }}
                />
                <button className="btn kucuk" onClick={adKaydet}>✓</button>
                <button
                  className="btn kucuk ikincil"
                  onClick={() => {
                    setAdDuzenle(false);
                    setAdHata(null);
                  }}
                >
                  ✕
                </button>
              </div>
              {adHata && <div className="alt-yazi" style={{ color: "var(--danger)" }}>{adHata}</div>}
            </div>
          ) : (
            <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.username}</span>
              <button
                title="Adını değiştir"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: 2 }}
                onClick={() => {
                  setYeniAd(profile?.username ?? "");
                  setAdDuzenle(true);
                }}
              >
                ✏️
              </button>
              {(profile?.seri ?? 0) > 0 && (
                <span className="rutbe-chip" style={{ color: "var(--accent)" }}>
                  🔥 {profile.seri} gün
                </span>
              )}
            </div>
          )}
          {!adDuzenle && <RankBadge puan={profile?.puan} />}
        </div>
        {!adDuzenle && (
          <Link to="/meydan">
            <button className="btn kucuk">⚔️ Meydan Oku</button>
          </Link>
        )}
      </div>

      {gorevler.length > 0 && (
        <div className="kart">
          <div className="baslik">📋 Günlük Görevler</div>
          {gorevler.map((g) => {
            const tamam = g.ilerleme >= g.hedef;
            return (
              <div key={g.quest_id} className="gorev-satir">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    <span>{g.alindi ? "✅ " : ""}{g.ad}</span>
                    <span className="alt-yazi">{g.ilerleme}/{g.hedef}</span>
                  </div>
                  <div className="soru-sayac" style={{ height: 6, marginBottom: 0 }}>
                    <div
                      className="dolgu"
                      style={{
                        width: `${(g.ilerleme / g.hedef) * 100}%`,
                        background: g.alindi
                          ? "var(--success)"
                          : "linear-gradient(90deg, var(--primary), var(--accent))",
                      }}
                    />
                  </div>
                </div>
                {g.alindi ? (
                  <span className="rutbe-chip" style={{ color: "var(--success)" }}>+{g.odul}⭐</span>
                ) : tamam ? (
                  <button className="btn kucuk" onClick={() => odulAl(g.quest_id)}>
                    🎁 +{g.odul}⭐ Al
                  </button>
                ) : (
                  <span className="rutbe-chip">+{g.odul}⭐</span>
                )}
              </div>
            );
          })}
        </div>
      )}

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
