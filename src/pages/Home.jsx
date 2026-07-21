import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import Avatar from "../components/Avatar.jsx";
import { pushDestekleniyor, bildirimleriAc } from "../lib/push.js";
import { sonrakiTurnuvaSeans } from "../lib/zaman.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";

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

  const puan = profile?.puan ?? 0;
  const rutbe = rutbeBul(puan);
  const sonraki = sonrakiRutbe(puan);
  const ilerleme = sonraki
    ? Math.min(100, Math.round(((puan - rutbe.min) / (sonraki.min - rutbe.min)) * 100))
    : 100;

  return (
    <div className="anasayfa">

      {bildirimSor && (
        <div className="bildirim-serit">
          <div className="ikon">🔔</div>
          <div className="metin">Turnuva başlarken haber verelim mi?</div>
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

      {/* ---------- Oyuncu Paneli (Hero) ---------- */}
      <div className="hero-panel">
        <div className="hero-glow" />
        <div className="hero-ust">
          <div className={`hero-avatar rutbe-halka`} style={{ "--halka": rutbe.renk }}>
            <Avatar profile={profile} boyut={64} />
            <span className="hero-rutbe-ikon">{rutbe.ikon}</span>
          </div>
          <div className="hero-bilgi">
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
              <>
                <div className="hero-isim">
                  <span className="ad">{profile?.username}</span>
                  <button
                    title="Adını değiştir"
                    className="ad-duzenle"
                    onClick={() => {
                      setYeniAd(profile?.username ?? "");
                      setAdDuzenle(true);
                    }}
                  >
                    ✏️
                  </button>
                </div>
                <div className="hero-rozetler">
                  <span className="rutbe-chip" style={{ color: rutbe.renk }}>
                    {rutbe.ikon} {rutbe.ad}
                  </span>
                  {(profile?.seri ?? 0) > 0 && (
                    <span className="rutbe-chip seri">🔥 {profile.seri} gün</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="hero-puan">
            <div className="deger">⭐ {puan}</div>
            <div className="etiket">puan</div>
          </div>
        </div>
        {!adDuzenle && (
          <div className="xp-alan">
            <div className="xp-bar">
              <div className="dolgu" style={{ width: `${ilerleme}%` }} />
            </div>
            <div className="xp-yazi">
              {sonraki
                ? <>Sonraki rütbe <b style={{ color: sonraki.renk }}>{sonraki.ikon} {sonraki.ad}</b> · {sonraki.min - puan} puan kaldı</>
                : <>En yüksek rütbedesin! {rutbe.ikon} Efsane</>}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Turnuva Vitrini ---------- */}
      <div className="geri-sayim-kart">
        <div className="turnuva-seans">
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

      {/* ---------- Oyun Modları ---------- */}
      <div className="bolum-baslik"><span>🎮 Oyun Modları</span></div>
      <button className="mod-kart genis hemen" onClick={hemenOyna}>
        <span className="mod-ikon">⚡</span>
        <span className="mod-metin">
          <span className="mod-ad">Hemen Oyna</span>
          <span className="mod-alt">Rakip bul, 1v1 düelloya başla</span>
        </span>
        <span className="mod-ok">→</span>
      </button>

      <div className="mod-grid">
        <button className="mod-kart meydan" onClick={() => navigate("/meydan")}>
          <span className="mod-ikon">⚔️</span>
          <span className="mod-ad">Meydan Oku</span>
          <span className="mod-alt">Arkadaşına veya bota</span>
        </button>
        <button className="mod-kart hizli" onClick={() => navigate("/meydan")}>
          <span className="mod-ikon">🏁</span>
          <span className="mod-ad">Hızlı Olan Kazanır</span>
          <span className="mod-alt">İlk bilen puanı kapar</span>
        </button>
        <button className="mod-kart grup" onClick={() => navigate("/meydan")}>
          <span className="mod-ikon">👨‍👩‍👧‍👦</span>
          <span className="mod-ad">Grup Maçı</span>
          <span className="mod-alt">3-5 kişilik yarış</span>
        </button>
        <button className="mod-kart turnuva" onClick={() => navigate("/turnuva")}>
          <span className="mod-ikon">🏆</span>
          <span className="mod-ad">Turnuva</span>
          <span className="mod-alt">Son kalan kazanır</span>
        </button>
      </div>

      {/* ---------- Günlük Görevler ---------- */}
      {gorevler.length > 0 && (
        <>
          <div className="bolum-baslik"><span>📋 Günlük Görevler</span></div>
          <div className="kart">
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
                          width: `${Math.min(100, (g.ilerleme / g.hedef) * 100)}%`,
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
        </>
      )}

      {/* ---------- En İyiler ---------- */}
      <div className="bolum-baslik"><span>🔥 En İyiler</span></div>
      <div className="kart">
        {top5.map((p, i) => (
          <div key={p.id} className="lider-satir">
            <span className={`sira-no ${i < 3 ? "ilk3" : ""}`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <Avatar profile={p} boyut={32} />
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.username}</span>
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
