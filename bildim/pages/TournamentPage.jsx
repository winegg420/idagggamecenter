import { useCallback, useEffect, useRef, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import Maskot from "../components/Maskot.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useOyunModu } from "../lib/oyunModu.js";
import TurnuvaTanitim from "../components/TurnuvaTanitim.jsx";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import YanlisSatiri from "../components/YanlisSatiri.jsx";
import MeydanaDonus from "../components/MeydanaDonus.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import OyuncuKarti from "../components/OyuncuKarti.jsx";
import AvatarCerceve from "../components/AvatarCerceve.jsx";
import { useNavigate } from "react-router-dom";
import { y } from "../lib/yol.js";
import { useGorunurlukTazele, zamanAsimiyla } from "../lib/gorunurluk.js";

export default function TournamentPage() {
  const { user, refreshProfile } = useAuth();
  const [turnuva, setTurnuva] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [soru, setSoru] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  // Lobide bir oyuncuya dokununca açılan kart
  const [kartOyuncu, setKartOyuncu] = useState(null);
  const navigate = useNavigate();
  const advanceKilidi = useRef(false);

  /** Lobideki oyuncuya meydan okuma — kart da buradan kapanır. */
  const meydanOku = async (hedefId) => {
    setHata(null);
    setKartOyuncu(null);
    try {
      const { data, error } = await supabase.rpc("create_challenge", {
        p_rakip: hedefId,
        p_kategori: null,
      });
      if (error) throw error;
      if (data) navigate(y(`/mac/${data}`));
    } catch (e) {
      setHata(hataMesaji(e, "Meydan okuma başlatılamadı."));
    }
  };
  // Süre doldu ama ilerletme henüz başarılı olmadı mı? Dönüşte hemen denenir.
  const bekleyenIlerletme = useRef(false);
  const kanalRef = useRef(null);
  // Kanal düştüğünde yeniden kurma zamanlayıcısı ve güncel kanalKur referansı
  const yenidenBaglaRef = useRef(null);
  const kanalKurRef = useRef(null);

  const turnuvaYukle = useCallback(async () => {
    // error okunmazsa turnuva hiç yüklenmemiş gibi görünür ve sebebi
    // hiçbir yere düşmez; kullanıcıya da gösterilecek bir mesaj kalmaz.
    let data = null;
    try {
      const sonuc = await supabase
        .from("tournaments")
        .select("*")
        .order("tarih", { ascending: false })
        .limit(3);
      if (sonuc.error) throw sonuc.error;
      data = sonuc.data;
    } catch (e) {
      console.error("[Bildim] turnuvalar alınamadı:", e);
      setHata(hataMesaji(e, "Turnuva bilgisi alınamadı."));
    }
    const liste = data ?? [];
    const secilen =
      liste.find((t) => t.durum === "aktif") ??
      liste.find((t) => t.durum === "lobi") ??
      liste[0] ??
      null;
    setTurnuva(secilen);
    if (secilen) {
      try {
        const { data: ply, error } = await supabase
          .from("tournament_players")
          .select("*, profil:profiles(gorunen_ad, gorunen_avatar, gorunum, puan)")
          .eq("tournament_id", secilen.id)
          .order("joined_at");
        if (error) throw error;
        setOyuncular(ply ?? []);
      } catch (e) {
        console.error("[Bildim] turnuva oyuncuları alınamadı:", e);
      }
    }
    setYukleniyor(false);
    return secilen;
  }, []);

  // Kanal kurulumu ayrı fonksiyonda: sekmeden dönüşte ölmüş soket yeniden kurulur.
  const kanalKur = useCallback(() => {
    const kanal = supabase
      .channel("turnuva")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => turnuvaYukle()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_players" },
        () => turnuvaYukle()
      )
      // Kanal ölürse sessizce kalmasın: Realtime kopmasi (ag dalgalanmasi,
      // uyku, arka plan) CHANNEL_ERROR/TIMED_OUT/CLOSED olarak bildirilir.
      // Yoklama zaten veriyi getiriyor ama kanal geri kurulmazsa anlık
      // güncellemeler (rakip skoru, mesaj) bir daha hiç gelmiyordu.
      .subscribe((durum) => {
        if (durum === "CHANNEL_ERROR" || durum === "TIMED_OUT" || durum === "CLOSED") {
          console.warn("[Bildim] turnuva kanali dustu:", durum);
          if (yenidenBaglaRef.current) clearTimeout(yenidenBaglaRef.current);
          yenidenBaglaRef.current = setTimeout(() => {
            if (kanalRef.current !== kanal) return; // baska kanal kurulmus
            try {
              supabase.removeChannel(kanal);
              kanalKurRef.current?.();
            } catch (e) {
              console.error("[Bildim] kanal yeniden kurulamadi:", e);
            }
          }, 2000);
        }
      });
    kanalRef.current = kanal;
    return kanal;
  }, [turnuvaYukle]);

  // İlk yükleme + realtime
  // Kanal izleyicisi kanalKur'u çağırabilsin (kanalKur kendi tanımına
  // referans veremediği için güncel hâli her render'da ref'e yazılır).
  kanalKurRef.current = kanalKur;

  useEffect(() => {
    turnuvaYukle();
    kanalKur();
    return () => {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalRef.current = null;
      if (yenidenBaglaRef.current) clearTimeout(yenidenBaglaRef.current);
    };
  }, [turnuvaYukle, kanalKur]);

  // Sekmeden dönünce: sunucudaki güncel durumu çek + Realtime kanalını yenile.
  // Ortak soru saati olduğu için istemci ekstra atlama tetiklemez.
  useGorunurlukTazele(() => {
    turnuvaYukle();
    // Arka planda setTimeout donduğu için bekleyen ilerletme burada çalışır.
    if (bekleyenIlerletme.current) ilerletmeyiDene();
    try {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalKur();
    } catch (e) {
      console.error("[Bildim] realtime yeniden kurulamadi:", e);
    }
  }, turnuva?.durum === "aktif");

  // Aktif soru değiştiğinde soruyu çek
  useEffect(() => {
    if (!turnuva || turnuva.durum !== "aktif" || turnuva.aktif_soru < 0) {
      setSoru(null);
      return;
    }
    advanceKilidi.current = false;
    bekleyenIlerletme.current = false;
    supabase
      .rpc("get_tournament_question", { p_tournament_id: turnuva.id })
      .then(({ data, error }) => {
        if (!error && data?.[0]) setSoru(data[0]);
      });
  }, [turnuva?.id, turnuva?.durum, turnuva?.aktif_soru]);

  // Turnuva bitince puanlar değişmiş olabilir
  useEffect(() => {
    if (turnuva?.durum === "bitti") refreshProfile(user.id);
  }, [turnuva?.durum, refreshProfile, user.id]);

  const benimKayit = oyuncular.find((o) => o.user_id === user.id);
  const hayatta = oyuncular.filter((o) => !o.elendi);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_tournament_answer", {
      p_tournament_id: turnuva.id,
      p_cevap: i,
    });
    if (error) throw error;
    return data?.[0];
  };

  // İlerletme: hata yutulmaz, kilit başarısızlıkta AÇILIR. Eskiden RPC'nin
  // sonucuna hiç bakılmıyordu; sekme arka plandayken çağrı düşerse tur
  // ilerlemiyor, advanceKilidi kapalı kaldığı için de yeniden denenmiyordu.
  const ilerletmeyiDene = useCallback(async () => {
    if (!turnuva) return;
    try {
      const { error } = await zamanAsimiyla(
        supabase.rpc("advance_tournament", { p_tournament_id: turnuva.id }),
        10000,
        "advance_tournament"
      );
      if (error) throw error;
      bekleyenIlerletme.current = false;
      await turnuvaYukle();
    } catch (e) {
      console.error("[Bildim] turnuva ilerletilemedi, yeniden denenecek:", e);
      advanceKilidi.current = false;
      turnuvaYukle();
    }
  }, [turnuva, turnuvaYukle]);

  // Süre dolunca ilerletme "bekleyen iş" olarak işaretlenir. Rastgele gecikme
  // aynı anda yüzlerce istemcinin sunucuya yüklenmemesi için. setTimeout arka
  // planda donduğundan dönüşte bekleyen iş gecikmesiz çalıştırılır.
  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current || !turnuva) return;
    advanceKilidi.current = true;
    bekleyenIlerletme.current = true;
    setTimeout(() => {
      if (bekleyenIlerletme.current) ilerletmeyiDene();
    }, Math.random() * 1200 + 1100);
  }, [turnuva, ilerletmeyiDene]);

  const lobiyeKatil = async () => {
    setHata(null);
    const { error } = await supabase.rpc("join_tournament_lobby");
    if (error) setHata(hataMesaji(error));
    else turnuvaYukle();
  };

  const lobidenAyril = async () => {
    await supabase.rpc("leave_tournament_lobby");
    turnuvaYukle();
  };

  useOyunModu(Boolean(soru) && turnuva?.durum === "aktif");

  if (yukleniyor) return <div className="yukleniyor">Yükleniyor…</div>;

  // ---- Lobi yok / sıradaki turnuva ----
  if (!turnuva || turnuva.durum === "bitti" || turnuva.durum === "iptal") {
    const kazanan =
      turnuva?.durum === "bitti"
        ? oyuncular.find((o) => o.user_id === turnuva.kazanan)
        : null;
    return (
      <div>
        {kazanan && (
          <div className="kart" style={{ textAlign: "center" }}>
            <Ikon ad="kupa" boyut={38} />
            <div className="baslik" style={{ marginBottom: 4 }}>
              Son turnuvanın şampiyonu
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
              {kazanan.profil?.gorunen_ad}
            </div>
          </div>
        )}
        {turnuva?.durum === "bitti" && (
          <>
            {/* Meydandan girilmişse turnuva bitince oraya dönülür */}
            <MeydanaDonus />
            <YanlisSatiri macTur="turnuva" macId={turnuva.id} />
          </>
        )}
        <div className="geri-sayim-kart">
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
            SIRADAKİ TURNUVA
          </div>
          <Countdown />
          {hata && <div className="hata-kutu">{hata}</div>}
          <button className="btn" onClick={lobiyeKatil}>
            Lobiye katıl
          </button>
        </div>

        <TurnuvaTanitim />
      </div>
    );
  }

  // ---- Lobi ----
  if (turnuva.durum === "lobi") {
    return (
      <div>
        <div className="geri-sayim-kart">
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--bd-odul-metin)" }}>
            TURNUVA LOBİSİ
          </div>
          <Countdown onSifir={turnuvaYukle} />
          {hata && <div className="hata-kutu">{hata}</div>}
          {benimKayit ? (
            <button className="btn ikincil" onClick={lobidenAyril}>
              Lobiden Ayrıl
            </button>
          ) : (
            <button className="btn" onClick={lobiyeKatil}>
              Lobiye katıl
            </button>
          )}
        </div>
        <div className="kart">
          {kartOyuncu && (
            <OyuncuKarti
              userId={kartOyuncu.id}
              onIzleme={kartOyuncu}
              onKapat={() => setKartOyuncu(null)}
              onMeydanOku={kartOyuncu.id === user.id ? undefined : meydanOku}
            />
          )}
          <div className="baslik">Lobideki Oyuncular ({oyuncular.length})</div>
          {oyuncular.length === 0 && (
            <div className="bd-bos-durum">
              <Maskot poz="dusunuyor" boyut={78} />
              <p>Lobi henüz boş — ilk katılan sen ol, turnuva başlayınca haber veririz.</p>
            </div>
          )}
          {/* Satıra dokunmak oyuncu kartını açar: avatar, rütbe, puan ve
              (kendisi değilse) meydan okuma düğmesi. */}
          {oyuncular.map((o) => (
            <button
              key={o.user_id}
              type="button"
              className="bd-lobi-oyuncu"
              onClick={() => setKartOyuncu({ id: o.user_id, ...(o.profil ?? {}) })}
              title={`${o.profil?.gorunen_ad ?? "Oyuncu"} — kartını aç`}
            >
              <AvatarCerceve profile={o.profil} boyut={32} userId={o.user_id} />
              <span>{o.profil?.gorunen_ad}</span>
              {o.user_id !== user.id && (
                <span
                  className="bd-lobi-kilic"
                  role="button"
                  tabIndex={0}
                  aria-label={`${o.profil?.gorunen_ad ?? "Oyuncu"} oyuncusuna meydan oku`}
                  onClick={(e) => { e.stopPropagation(); meydanOku(o.user_id); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); meydanOku(o.user_id); }
                  }}
                >
                  <Ikon ad="kilic" boyut={15} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- Aktif turnuva ----
  const elendim = benimKayit?.elendi;
  const izleyiciyim = !benimKayit;

  return (
    <div>
      {/* ALTIN SORU: sorular bitti, hayatta kalanlar eşit. Eleme turnuvası
          berabere bitemez — biri kazanana kadar yeni soru gelir. */}
      {soru?.altin ? (
        <div className="durum-bandi altin-soru">
          <Ikon ad="yildiz" boyut={15} /> ALTIN SORU · {hayatta.length} oyuncu
          başa baş — biri bilene kadar sürer
        </div>
      ) : (
        <div className="durum-bandi canli">
          <span className="canli-nokta" />
          CANLI · {hayatta.length} oyuncu hayatta · Soru {turnuva.aktif_soru + 1}/
          {turnuva.soru_ids?.length ?? "?"}
        </div>
      )}

      {elendim && (
        <div className="durum-bandi elendi">
          Elendin. Kalan oyuncuları izlemeye devam edebilirsin.
        </div>
      )}
      {izleyiciyim && (
        <div className="durum-bandi elendi">İzleyici modundasın.</div>
      )}

      {soru && !elendim && !izleyiciyim ? (
        <QuestionCard
          key={`${turnuva.id}-${turnuva.aktif_soru}`}
          className={soru.altin ? "bd-altin-soru" : ""}
          soru={soru}
          onCevapla={cevapla}
          onSureDoldu={sureDoldu}
          macTur="turnuva"
          macId={turnuva.id}
        />
      ) : (
        soru && (
          <div className="kart">
            <div className="soru-metin">{soru.soru}</div>
            <div className="alt-yazi">Oyuncular cevaplıyor…</div>
          </div>
        )
      )}

      <div className="kart" style={{ marginTop: 14 }}>
        <div className="baslik">Hayatta Kalanlar</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {hayatta.map((o) => (
            <span key={o.user_id} className="rutbe-chip" style={{ color: "var(--success)" }}>
              {o.profil?.gorunen_ad} ({o.dogru_sayisi} doğru)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
