import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import { pushDestekleniyor, bildirimleriAc } from "../lib/push.js";
import { sonrakiTurnuvaSeans } from "../lib/zaman.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";
import KonumSecici from "../components/KonumSecici.jsx";
import { bayrak, haftaBitisi, sureMetni } from "../lib/konum.js";

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
  const [ligDurum, setLigDurum] = useState(null);
  const [gecenHafta, setGecenHafta] = useState(null);
  const [haftaKalan, setHaftaKalan] = useState(
    () => haftaBitisi().getTime() - Date.now()
  );

  // İlk girişte konum sorulur; profil yüklenene kadar modal açılmaz.
  const konumEksik = Boolean(profile) && !profile.ulke;

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

  // Lig özeti (hero) + geçen haftanın sonucu (uygulama içi banner)
  const ligYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("benim_lig_durumum", {
        p_donem: "hafta",
      });
      if (error) throw error;
      setLigDurum(Array.isArray(data) ? (data[0] ?? null) : (data ?? null));
    } catch {
      setLigDurum(null); // RPC henüz uygulanmamış olabilir — sessiz geç
    }
  }, []);

  useEffect(() => {
    ligYukle();
  }, [ligYukle, profile?.puan_hafta, profile?.sehir]);

  useEffect(() => {
    const id = setInterval(
      () => setHaftaKalan(haftaBitisi().getTime() - Date.now()),
      60000
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let aktif = true;
    const yukle = async () => {
      try {
        const { data, error } = await supabase
          .from("lig_arsiv")
          .select("hafta, puan, sehir, ulke, sira_sehir, sira_ulke, sira_global")
          .eq("user_id", user.id)
          .order("hafta", { ascending: false })
          .limit(1);
        if (error) throw error;
        const kayit = (data ?? [])[0];
        if (!kayit || !aktif) return;
        if (localStorage.getItem("bildim_hafta_okundu") === kayit.hafta) return;
        setGecenHafta(kayit);
      } catch {
        /* tablo henüz yok veya ağ hatası — sessiz geç */
      }
    };
    yukle();
    return () => {
      aktif = false;
    };
  }, [user.id]);

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
    else if (data) navigate(`/bildim/mac/${data}`);
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

      {/* İlk girişte zorunlu: hangi şehir için yarışıyorsun? */}
      {konumEksik && <KonumSecici mod="modal" onKaydedildi={ligYukle} />}

      {/* Haftalık sonuç bildirimi (push kapalıysa da görünür) */}
      {gecenHafta && (
        <div className="bd-hafta-sonuc">
          <div className="ikon">🏆</div>
          <div className="metin">
            Geçen hafta{" "}
            {gecenHafta.sira_sehir
              ? <>{gecenHafta.sehir} liginde <b>{gecenHafta.sira_sehir}.</b></>
              : <>dünya liginde <b>{gecenHafta.sira_global}.</b></>}{" "}
            oldun ({gecenHafta.puan} puan). Yeni hafta başladı!
          </div>
          <button
            className="btn kucuk ikincil"
            aria-label="Kapat"
            onClick={() => {
              try {
                localStorage.setItem("bildim_hafta_okundu", gecenHafta.hafta);
              } catch { /* özel mod */ }
              setGecenHafta(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

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

        {/* Lig özeti: rank kasma motivasyonu (şehir / ülke / dünya sırası) */}
        {!adDuzenle && ligDurum && (
          <div className="bd-hero-lig">
            {ligDurum.sehir && (
              <Link to="/bildim/siralama" className="bd-lig-rozet">
                <span className="bd-lig-rozet-ust">
                  {bayrak(ligDurum.ulke)} {ligDurum.sehir}
                </span>
                <span className="bd-lig-rozet-deger">{ligDurum.sira_sehir}.</span>
                <span className="bd-lig-rozet-alt">/ {ligDurum.sehir_oyuncu}</span>
              </Link>
            )}
            {ligDurum.ulke && (
              <Link to="/bildim/siralama" className="bd-lig-rozet">
                <span className="bd-lig-rozet-ust">🏳️ Ülke</span>
                <span className="bd-lig-rozet-deger">{ligDurum.sira_ulke}.</span>
                <span className="bd-lig-rozet-alt">/ {ligDurum.ulke_oyuncu}</span>
              </Link>
            )}
            <Link to="/bildim/siralama" className="bd-lig-rozet">
              <span className="bd-lig-rozet-ust">🌍 Dünya</span>
              <span className="bd-lig-rozet-deger">{ligDurum.sira_global}.</span>
              <span className="bd-lig-rozet-alt">/ {ligDurum.global_oyuncu}</span>
            </Link>
          </div>
        )}

        {!adDuzenle && (
          <div className="bd-hero-hafta">
            ⏳ Haftalık lig bitimine <b>{sureMetni(haftaKalan)}</b>
            {ligDurum?.sehrin_ulke_sirasi != null && ligDurum.sehir && (
              <>
                {" · "}
                {ligDurum.sehir} ülkende <b>{ligDurum.sehrin_ulke_sirasi}.</b>
              </>
            )}
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
            <button className="btn" onClick={() => navigate("/bildim/turnuva")}>
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
              <button className="btn ikincil" onClick={() => navigate("/bildim/turnuva")}>
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
        <button className="mod-kart meydan" onClick={() => navigate("/bildim/meydan")}>
          <span className="mod-ikon">⚔️</span>
          <span className="mod-ad">Meydan Oku</span>
          <span className="mod-alt">Arkadaşına veya bota</span>
        </button>
        <button className="mod-kart hizli" onClick={() => navigate("/bildim/meydan")}>
          <span className="mod-ikon">🏁</span>
          <span className="mod-ad">Hızlı Olan Kazanır</span>
          <span className="mod-alt">İlk bilen puanı kapar</span>
        </button>
        <button className="mod-kart grup" onClick={() => navigate("/bildim/meydan")}>
          <span className="mod-ikon">👨‍👩‍👧‍👦</span>
          <span className="mod-ad">Grup Maçı</span>
          <span className="mod-alt">3-5 kişilik yarış</span>
        </button>
        <button className="mod-kart turnuva" onClick={() => navigate("/bildim/turnuva")}>
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
        <Link to="/bildim/siralama" className="alt-yazi" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
          Tüm sıralamayı gör →
        </Link>
      </div>
    </div>
  );
}
