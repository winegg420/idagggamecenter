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
import { y } from "../lib/yol.js";

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
  const [siraSendeMaclar, setSiraSendeMaclar] = useState([]);
  // Hatalarım bankasında bekleyen soru sayısı (mod kartı rozeti)
  const [bankaBekleyen, setBankaBekleyen] = useState(0);
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

  // Hatalarım bankası — mod kartındaki rozet için
  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("yanlis_bankam");
        if (error) throw error;
        const ilk = (data ?? [])[0];
        if (aktif) setBankaBekleyen(ilk?.bekleyen ?? 0);
      } catch {
        /* migration bekliyor olabilir — rozet gizli kalır */
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Asenkron maçlar: sırası BENDE olan yarım kalmış müsabakalar
  const siraYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("id, oyuncu1, oyuncu2, oyuncu1_soru, oyuncu2_soru, soru_ids")
        .eq("durum", "aktif")
        .or("oyuncu1.eq." + user.id + ",oyuncu2.eq." + user.id)
        .limit(10);
      if (error) throw error;
      const benim = (data ?? []).filter((m) => {
        const benP1 = m.oyuncu1 === user.id;
        const benimSoru = benP1 ? (m.oyuncu1_soru ?? 0) : (m.oyuncu2_soru ?? 0);
        return benimSoru < (m.soru_ids?.length ?? 20);
      });
      setSiraSendeMaclar(benim);
    } catch {
      setSiraSendeMaclar([]); // sessiz geç — ana sayfa akışını bozmasın
    }
  }, [user.id]);

  useEffect(() => {
    siraYukle();
    const kanal = supabase
      .channel("sira-sende")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, siraYukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [siraYukle]);

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
            navigate(y(`/mac/${macId}`));
          }}
          onIptal={() => setRakipAra(false)}
        />
      )}

      {/* Haftalık sonuç bildirimi (push kapalıysa da görünür) */}
      {gecenHafta && (
        <div className="bd-hafta-sonuc">
          <div className="ikon"><Ikon ad="kupa" boyut={20} /></div>
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
            <Ikon ad="carpi" boyut={16} />
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
          <span>Hemen oyna</span>
          <Ikon ad="ok" boyut={20} className="bd-ana-eylem-ok" />
        </button>
        {mesaj && <div className="hata-kutu" style={{ marginTop: 10 }}>{mesaj}</div>}
      </section>
      {/* KATMAN 1 BİTTİ.
          Lig sıralaması ve haftalık geri sayım buradan 2. katmana taşındı:
          aynı bilgi sayfanın hem en üstünde hem en altında iki kez duruyordu. */}

      {/* ============ KATMAN 2 — SENİ BEKLEYENLER ============
          Zaman baskılı işlerin hepsi tek başlık altında toplandı: sıra sende
          olan maçlar, turnuva geri sayımı, ezeli rakip, günlük görevler ve
          haftalık lig durumu. */}
      <section className="bd-katman bd-giris-2">
        <h2 className="bd-katman-baslik">Seni bekleyenler</h2>

        {/* Yarım kalan maçlar — sıra sendeyse en görünür yerde dursun */}
        {siraSendeMaclar.length > 0 && (
          <Link to={y("/mac/") + siraSendeMaclar[0].id} className="bd-devam-eden">
            <Ikon ad="saat" boyut={17} />
            <span>
              {siraSendeMaclar.length === 1
                ? "Yarım kalan maçın var — sıra sende!"
                : siraSendeMaclar.length + " maçta sıra sende!"}
            </span>
            <span className="ok" aria-hidden="true">›</span>
          </Link>
        )}

        {/* Turnuva: yatay bant — sayaç solda, eylem sağda */}
        {/* tema-turnuva: "Lobiye katıl" / "Katıl" turnuva morunu alsın */}
        <div className="bd-turnuva-serit tema-turnuva">
          <div className="bd-turnuva-sol">
            <div className="bd-turnuva-etiket">
              {sonrakiTurnuvaSeans() === "sabah" ? "SABAH TURNUVASI" : "GECE TURNUVASI"}
            </div>
            {canliTurnuva ? (
              <div className="bd-turnuva-canli">
                <span className="canli-nokta" />
                Şu an canlı
              </div>
            ) : (
              <Countdown />
            )}
          </div>
          <div className="bd-turnuva-sag">
            {canliTurnuva ? (
              <button className="btn kucuk" onClick={() => navigate(y("/turnuva"))}>
                Katıl
              </button>
            ) : lobide ? (
              <button className="btn kucuk ikincil" onClick={() => navigate(y("/turnuva"))}>
                Lobidesin ({lobiSayisi})
              </button>
            ) : (
              <button className="btn kucuk" onClick={lobiyeKatil}>
                Lobiye katıl
              </button>
            )}
          </div>
          {mesaj && <div className="hata-kutu" style={{ flexBasis: "100%" }}>{mesaj}</div>}
        </div>

        <EzeliRakip />

        {/* Günlük Görevler — tema-joker: "+N al" butonu joker magentasını alır */}
        {gorevler.length > 0 && (
          <div className="bd-gorev-acilir tema-joker">
            <button
              className={`bd-gorev-basi ${gorevlerAcik ? "acik" : ""}`}
              onClick={() => setGorevlerAcik((a) => !a)}
              aria-expanded={gorevlerAcik}
            >
              <Ikon ad="liste" boyut={17} />
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
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                          <span>{g.ad}</span>
                          <span className="alt-yazi">{g.ilerleme}/{g.hedef}</span>
                        </div>
                        <div className="bd-gorev-bar">
                          <div
                            className="dolgu"
                            style={{
                              width: `${Math.min(100, (g.ilerleme / g.hedef) * 100)}%`,
                              background: g.alindi ? "var(--bd-basari)" : "var(--bd-odul)",
                            }}
                          />
                        </div>
                      </div>
                      {g.alindi ? (
                        <span className="rutbe-chip" style={{ color: "var(--success)" }}>+{g.odul}</span>
                      ) : tamam ? (
                        <button className="btn kucuk" onClick={() => odulAl(g.quest_id)}>
                          +{g.odul} al
                        </button>
                      ) : (
                        <span className="rutbe-chip">+{g.odul}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Lig özeti — SAYFADA YALNIZ BURADA. Eskiden hem hero'da üç rozet
            hem sayfanın en altında şerit olarak iki kez duruyordu. */}
        <Link to={y("/siralama")} className="bd-lig-serit">
          <span className="bd-lig-serit-hucre">
            <b>{ligDurum?.sira_sehir ?? "—"}</b>
            <em>{ligDurum?.sehir ?? "Şehir"}</em>
          </span>
          <span className="bd-lig-serit-hucre">
            <b>{ligDurum?.sira_ulke ?? "—"}</b>
            <em>Ülke</em>
          </span>
          <span className="bd-lig-serit-hucre">
            <b>{ligDurum?.sira_global ?? "—"}</b>
            <em>Dünya</em>
          </span>
        </Link>
        <div className="bd-hero-hafta">
          <Ikon ad="saat" boyut={13} /> Haftalık lig bitimine <b>{sureMetni(haftaKalan)}</b>
        </div>
      </section>

      {/* ============ KATMAN 3 — MODLAR ============
          Düzenli ızgara, kaydırarak ulaşılır. Hiçbir mod kaldırılmadı. */}
      <section className="bd-katman bd-giris-3">
        <h2 className="bd-katman-baslik">Modlar</h2>
        <div className="bd-mod-grid">
          <button className="bd-mod bd-mod-genis tema-meydan" onClick={() => navigate(y("/meydan"))}>
            <span className="bd-mod-ikon"><Ikon ad="kilic" boyut={30} /></span>
            <span className="bd-mod-ad">Meydan Oku</span>
          </button>
          <button className="bd-mod tema-hizli" onClick={() => navigate(y("/hizli-mod"))}>
            <span className="bd-mod-ikon"><Ikon ad="saat" boyut={26} /></span>
            <span className="bd-mod-ad">Hızlı Mod</span>
          </button>
          <button className="bd-mod tema-grup" onClick={() => navigate(y("/meydan"))}>
            <span className="bd-mod-ikon"><Ikon ad="kisiler" boyut={26} /></span>
            <span className="bd-mod-ad">Grup Maçı</span>
          </button>
          <button className="bd-mod tema-turnuva" onClick={() => navigate(y("/turnuva"))}>
            <span className="bd-mod-ikon"><Ikon ad="kupa" boyut={26} /></span>
            <span className="bd-mod-ad">Turnuva</span>
          </button>
          <button className="bd-mod tema-joker" onClick={() => navigate(y("/joker"))}>
            <span className="bd-mod-ikon"><Ikon ad="yildiz" boyut={26} /></span>
            <span className="bd-mod-ad">Joker Dükkânı</span>
          </button>
          <button
            className="bd-mod bd-mod-genis tema-hatalarim"
            onClick={() => navigate(y("/calisma"))}
          >
            <span className="bd-mod-ikon hatalarim"><Ikon ad="kitap" boyut={26} /></span>
            <span className="bd-mod-ad">Hatalarım</span>
            {bankaBekleyen > 0 && (
              <span className="bd-mod-rozet">{bankaBekleyen}</span>
            )}
          </button>
          <button className="bd-mod bd-mod-genis tema-lig" onClick={() => navigate(y("/siralama"))}>
            <span className="bd-mod-ikon"><Ikon ad="grafik" boyut={26} /></span>
            <span className="bd-mod-ad">Lig</span>
          </button>
        </div>
      </section>
    </div>
  );
}
