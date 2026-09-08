import { useCallback, useEffect, useRef, useState } from "react";
import Maskot from "../components/Maskot.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useOyunModu } from "../lib/oyunModu.js";
import TurnuvaTanitim from "../components/TurnuvaTanitim.jsx";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Countdown from "../components/Countdown.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import Avatar from "../../src/components/Avatar.jsx";

export default function TournamentPage() {
  const { user, refreshProfile } = useAuth();
  const [turnuva, setTurnuva] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [soru, setSoru] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const advanceKilidi = useRef(false);

  const turnuvaYukle = useCallback(async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("tarih", { ascending: false })
      .limit(3);
    const liste = data ?? [];
    const secilen =
      liste.find((t) => t.durum === "aktif") ??
      liste.find((t) => t.durum === "lobi") ??
      liste[0] ??
      null;
    setTurnuva(secilen);
    if (secilen) {
      const { data: ply } = await supabase
        .from("tournament_players")
        .select("*, profil:profiles(gorunen_ad, gorunen_avatar, puan)")
        .eq("tournament_id", secilen.id)
        .order("joined_at");
      setOyuncular(ply ?? []);
    }
    setYukleniyor(false);
    return secilen;
  }, []);

  // İlk yükleme + realtime
  useEffect(() => {
    let kanal;
    turnuvaYukle().then((t) => {
      kanal = supabase
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
        .subscribe();
    });
    return () => kanal && supabase.removeChannel(kanal);
  }, [turnuvaYukle]);

  // Aktif soru değiştiğinde soruyu çek
  useEffect(() => {
    if (!turnuva || turnuva.durum !== "aktif" || turnuva.aktif_soru < 0) {
      setSoru(null);
      return;
    }
    advanceKilidi.current = false;
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

  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current || !turnuva) return;
    advanceKilidi.current = true;
    // Aynı anda yüzlerce istemci çağırmasın diye küçük rastgele gecikme
    setTimeout(() => {
      supabase.rpc("advance_tournament", { p_tournament_id: turnuva.id });
      // Realtime kaçarsa emniyet: 3 sn sonra yeniden yükle
      setTimeout(turnuvaYukle, 3000);
    }, Math.random() * 1200 + 1100);
  }, [turnuva, turnuvaYukle]);

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
            <div style={{ fontSize: 40 }}>🏆</div>
            <div className="baslik" style={{ marginBottom: 4 }}>
              Son turnuvanın şampiyonu
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
              {kazanan.profil?.gorunen_ad}
            </div>
          </div>
        )}
        <div className="geri-sayim-kart">
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
            🌙 SIRADAKİ TURNUVA
          </div>
          <Countdown />
          {hata && <div className="hata-kutu">{hata}</div>}
          <button className="btn" onClick={lobiyeKatil}>
            🎟️ Lobiye Katıl
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
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
            🌙 TURNUVA LOBİSİ
          </div>
          <Countdown onSifir={turnuvaYukle} />
          {hata && <div className="hata-kutu">{hata}</div>}
          {benimKayit ? (
            <button className="btn ikincil" onClick={lobidenAyril}>
              Lobiden Ayrıl
            </button>
          ) : (
            <button className="btn" onClick={lobiyeKatil}>
              🎟️ Lobiye Katıl
            </button>
          )}
        </div>
        <div className="kart">
          <div className="baslik">Lobideki Oyuncular ({oyuncular.length})</div>
          {oyuncular.length === 0 && (
            <div className="bd-bos-durum">
              <Maskot poz="dusunuyor" boyut={78} />
              <p>Lobi henüz boş — ilk katılan sen ol, turnuva başlayınca haber veririz.</p>
            </div>
          )}
          {oyuncular.map((o) => (
            <div key={o.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <Avatar profile={o.profil} boyut={32} />
              <span style={{ fontWeight: 600 }}>{o.profil?.gorunen_ad}</span>
            </div>
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
      <div className="durum-bandi canli">
        <span className="canli-nokta" />
        CANLI · {hayatta.length} oyuncu hayatta · Soru {turnuva.aktif_soru + 1}/
        {turnuva.soru_ids?.length ?? "?"}
      </div>

      {elendim && (
        <div className="durum-bandi elendi">
          💀 Elendin! Kalan oyuncuları izlemeye devam edebilirsin.
        </div>
      )}
      {izleyiciyim && (
        <div className="durum-bandi elendi">👀 İzleyici modundasın.</div>
      )}

      {soru && !elendim && !izleyiciyim ? (
        <QuestionCard
          key={`${turnuva.id}-${turnuva.aktif_soru}`}
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
              {o.profil?.gorunen_ad} ({o.dogru_sayisi}✓)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
