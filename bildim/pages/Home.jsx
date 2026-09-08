import { useCallback, useEffect, useState } from "react";
import { hataMesaji } from "../lib/hata.js";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import { sonrakiTurnuvaSeans } from "../lib/zaman.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";
import { bayrak, haftaBitisi, sureMetni } from "../lib/konum.js";
import RakipAra from "../components/RakipAra.jsx";
import Ikon from "../components/Ikon.jsx";
import RankBadge from "../components/RankBadge.jsx";
import SeriRozeti from "../components/SeriRozeti.jsx";
import EzeliRakip from "../components/EzeliRakip.jsx";
import Maskot from "../components/Maskot.jsx";

export default function Home() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [lobide, setLobide] = useState(false);
  const [lobiSayisi, setLobiSayisi] = useState(0);
  const [canliTurnuva, setCanliTurnuva] = useState(false);
  const [mesaj, setMesaj] = useState(null);
  const [gorevler, setGorevler] = useState([]);
  const [ligDurum, setLigDurum] = useState(null);
  const [gecenHafta, setGecenHafta] = useState(null);
  const [rakipAra, setRakipAra] = useState(false);
  const [gorevlerAcik, setGorevlerAcik] = useState(false);
  // Ödülü alınmayı bekleyen görev sayısı (kapalıyken de görünür)
  const hazirOdul = gorevler.filter((g) => g.ilerleme >= g.hedef && !g.alindi).length;
  const [haftaKalan, setHaftaKalan] = useState(
    () => haftaBitisi().getTime() - Date.now()
  );

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

      // Ana sayfada uzun lider listesi yok (Faz 3): lig özeti tek satırda,
      // tam sıralama Lig sayfasında.
    };
    yukle();
  }, [user]);

  const lobiyeKatil = async () => {
    setMesaj(null);
    const { error } = await supabase.rpc("join_tournament_lobby");
    if (error) setMesaj(hataMesaji(error));
    else {
      setLobide(true);
      setLobiSayisi((n) => n + 1);
    }
  };

  // Hemen Oyna: önce tercih edilen kategoride insan rakip aranır (20 sn),
  // bulunamazsa karışığa/bota düşülür. Akış RakipAra bileşeninde.
  const hemenOyna = () => {
    setMesaj(null);
    setRakipAra(true);
  };

  const puan = profile?.puan ?? 0;
  const rutbe = rutbeBul(puan);
  const sonraki = sonrakiRutbe(puan);
  const ilerleme = sonraki
    ? Math.min(100, Math.round(((puan - rutbe.min) / (sonraki.min - rutbe.min)) * 100))
    : 100;

  return (
    <div className="anasayfa">

      {rakipAra && (
        <RakipAra
          kategori={profile?.tercih_kategori ?? null}
          onBulundu={(macId) => {
            setRakipAra(false);
            navigate(`/bildim/mac/${macId}`);
          }}
          onIptal={() => setRakipAra(false)}
        />
      )}

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

      {/* ---------- HERO: tek odak — rütbe, haftalık sıra, birincil eylem ---------- */}
      <section className="bd-hero bd-giris-1">
        <div className="bd-hero-isik" aria-hidden="true" />

        <div className="bd-hero-kimlik">
          <Maskot poz="selam" boyut={78} className="bd-hero-maskot" />
          <div className="bd-hero-ad-blok">
            <div className="bd-hero-selam">Hoş geldin,</div>
            <div className="bd-hero-ad">{profile?.gorunen_ad ?? "Oyuncu"}</div>
            <RankBadge puan={puan} />
          </div>
          <div className="bd-hero-halka" style={{ "--halka": rutbe.renk }}>
            <Avatar profile={profile} boyut={54} />
          </div>
        </div>

        <div className="bd-hero-puan">
          <span className="bd-hero-puan-sayi">{puan}</span>
          <span className="bd-hero-puan-etiket">puan</span>
        </div>

        <div className="bd-hero-ilerleme">
          <div className="bd-hero-bar">
            <div className="dolgu" style={{ width: `${ilerleme}%` }} />
          </div>
          <div className="bd-hero-ilerleme-yazi">
            {sonraki ? (
              <>
                <b style={{ color: sonraki.renk }}>{sonraki.ad}</b> rütbesine{" "}
                {sonraki.min - puan} puan
              </>
            ) : (
              <>En yüksek rütbedesin</>
            )}
          </div>
        </div>

        <SeriRozeti />

        <button className="bd-ana-eylem" onClick={hemenOyna}>
          <Ikon ad="hizli" boyut={22} />
          <span>HEMEN OYNA</span>
          <Ikon ad="ok" boyut={20} className="bd-ana-eylem-ok" />
        </button>
        {mesaj && <div className="hata-kutu" style={{ marginTop: 10 }}>{mesaj}</div>}

        {ligDurum && (
          <div className="bd-hero-lig">
            {ligDurum.sehir && (
              <Link to="/bildim/siralama" className="bd-lig-rozet">
                <span className="bd-lig-rozet-ust">
                  <Ikon ad="sehir" boyut={13} /> {ligDurum.sehir}
                </span>
                <span className="bd-lig-rozet-deger">{ligDurum.sira_sehir}.</span>
                <span className="bd-lig-rozet-alt">/ {ligDurum.sehir_oyuncu}</span>
              </Link>
            )}
            {ligDurum.ulke && (
              <Link to="/bildim/siralama" className="bd-lig-rozet">
                <span className="bd-lig-rozet-ust">
                  <Ikon ad="bayrak" boyut={13} /> Ülke
                </span>
                <span className="bd-lig-rozet-deger">{ligDurum.sira_ulke}.</span>
                <span className="bd-lig-rozet-alt">/ {ligDurum.ulke_oyuncu}</span>
              </Link>
            )}
            <Link to="/bildim/siralama" className="bd-lig-rozet">
              <span className="bd-lig-rozet-ust">
                <Ikon ad="dunya" boyut={13} /> Dünya
              </span>
              <span className="bd-lig-rozet-deger">{ligDurum.sira_global}.</span>
              <span className="bd-lig-rozet-alt">/ {ligDurum.global_oyuncu}</span>
            </Link>
          </div>
        )}

        <div className="bd-hero-hafta">
          <Ikon ad="saat" boyut={13} /> Haftalık lig bitimine <b>{sureMetni(haftaKalan)}</b>
        </div>
      </section>

      {/* ---------- Oyun modları: 2 sütun, ikon + iki kelime ---------- */}
      <div className="bd-mod-grid bd-giris-2">
        <button className="bd-mod tema-meydan" onClick={() => navigate("/bildim/meydan")}>
          <span className="bd-mod-ikon"><Ikon ad="kilic" boyut={26} /></span>
          <span className="bd-mod-ad">Meydan Oku</span>
          <span className="bd-mod-slogan">Arkadaşını yen</span>
        </button>
        <button className="bd-mod tema-hizli" onClick={() => navigate("/bildim/hizli-mod")}>
          <span className="bd-mod-ikon"><Ikon ad="saat" boyut={26} /></span>
          <span className="bd-mod-ad">Hızlı Mod</span>
          <span className="bd-mod-slogan">60 saniye</span>
        </button>
        <button className="bd-mod tema-grup" onClick={() => navigate("/bildim/meydan")}>
          <span className="bd-mod-ikon"><Ikon ad="kisiler" boyut={26} /></span>
          <span className="bd-mod-ad">Grup Maçı</span>
          <span className="bd-mod-slogan">3-5 kişi</span>
        </button>
        <button className="bd-mod tema-turnuva" onClick={() => navigate("/bildim/turnuva")}>
          <span className="bd-mod-ikon"><Ikon ad="kupa" boyut={26} /></span>
          <span className="bd-mod-ad">Turnuva</span>
          <span className="bd-mod-slogan">Son kalan kazanır</span>
        </button>
        <button className="bd-mod tema-joker" onClick={() => navigate("/bildim/joker")}>
          <span className="bd-mod-ikon"><Ikon ad="yildiz" boyut={26} /></span>
          <span className="bd-mod-ad">Joker Dükkânı</span>
          <span className="bd-mod-slogan">Güçlen</span>
        </button>
        <button className="bd-mod tema-lig" onClick={() => navigate("/bildim/siralama")}>
          <span className="bd-mod-ikon"><Ikon ad="grafik" boyut={26} /></span>
          <span className="bd-mod-ad">Lig</span>
          <span className="bd-mod-slogan">Sıranı gör</span>
        </button>
      </div>

      {/* ---------- Turnuva Vitrini ---------- */}
      <div className="geri-sayim-kart bd-turnuva-bant bd-giris-3">
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

      <EzeliRakip />

      {/* ---------- Günlük Görevler ---------- */}
      {gorevler.length > 0 && (
        <div className="bd-gorev-acilir bd-giris-3">
          <button
            className={`bd-gorev-basi ${gorevlerAcik ? "acik" : ""}`}
            onClick={() => setGorevlerAcik((a) => !a)}
            aria-expanded={gorevlerAcik}
          >
            <span aria-hidden="true">📋</span>
            <span>Günlük Görevler</span>
            <span className="sayac">
              {hazirOdul > 0
                ? `${hazirOdul} ödül hazır!`
                : `${gorevler.filter((g) => g.alindi).length}/${gorevler.length}`}
            </span>
            <span className="ok" aria-hidden="true">›</span>
          </button>
          {gorevlerAcik && (
          <div className="bd-gorev-govde">
            {gorevler.map((g) => {
              const tamam = g.ilerleme >= g.hedef;
              return (
                <div key={g.quest_id} className="gorev-satir">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      <span>{g.alindi ? "✅ " : ""}{g.ad}</span>
                      <span className="alt-yazi">{g.ilerleme}/{g.hedef}</span>
                    </div>
                    <div className="bd-gorev-bar">
                      <div
                        className="dolgu"
                        style={{
                          width: `${Math.min(100, (g.ilerleme / g.hedef) * 100)}%`,
                          background: g.alindi
                            ? "var(--bd-basari)"
                            : "linear-gradient(90deg, var(--bd-vurgu), var(--bd-odul))",
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
        </div>
      )}

      {/* ---------- Lig özeti: uzun liste yerine tek satır ---------- */}
      <Link to="/bildim/siralama" className="bd-lig-tek-satir bd-giris-4">
        <span aria-hidden="true">🏙️</span>
        <span>
          {ligDurum?.sehir && ligDurum?.sira_sehir ? (
            <>
              Bu hafta <b>{ligDurum.sehir}</b> liginde{" "}
              <span className="sira">{ligDurum.sira_sehir}.</span> sıradasın
            </>
          ) : ligDurum?.sira_global ? (
            <>
              Bu hafta dünya liginde{" "}
              <span className="sira">{ligDurum.sira_global}.</span> sıradasın
            </>
          ) : (
            <>Ligdeki yerini gör</>
          )}
        </span>
        <span className="ok" aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
