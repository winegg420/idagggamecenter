import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import BildirimIzniSor from "../components/BildirimIzniSor.jsx";
import MacSonuEklentisi from "../components/MacSonuEklentisi.jsx";
import { useOyunModu } from "../lib/oyunModu.js";

const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, gorunen_ad, gorunen_avatar),
  p2:profiles!matches_oyuncu2_fkey(id, gorunen_ad, gorunen_avatar)`;

const EMOJILER = ["👍", "😂", "😮", "😡", "🔥", "😎"];
const KALIPLAR = [
  "İyi şanslar!",
  "Bunu biliyordum!",
  "Şanslıydın! 😏",
  "İyi oyun!",
  "Hadi bakalım!",
  "Vay be! 🤯",
  "AĞLAMA 😂",
  "HAHAHAHAHA",
];

export default function MatchPage() {
  const { id } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mac, setMac] = useState(null);
  const [soru, setSoru] = useState(null);
  const [cevapladim, setCevapladim] = useState(false);
  const [jokerKullanildi, setJokerKullanildi] = useState({ elli: false, sure: false });
  const [jokerHata, setJokerHata] = useState(null);
  const [balonlar, setBalonlar] = useState({}); // { [user_id]: mesaj }
  const [kaliplarAcik, setKaliplarAcik] = useState(false);
  const advanceKilidi = useRef(false);
  const pollRef = useRef(null);
  const balonTimer = useRef({});

  const balonGoster = useCallback((kimden, mesaj) => {
    setBalonlar((b) => ({ ...b, [kimden]: mesaj }));
    clearTimeout(balonTimer.current[kimden]);
    balonTimer.current[kimden] = setTimeout(() => {
      setBalonlar((b) => {
        const yeni = { ...b };
        delete yeni[kimden];
        return yeni;
      });
    }, 4000);
  }, []);

  const mesajGonder = async (mesaj) => {
    setKaliplarAcik(false);
    balonGoster(user.id, mesaj);
    await supabase.rpc("send_match_message", { p_match_id: id, p_mesaj: mesaj });
  };

  useEffect(() => {
    supabase
      .from("match_jokers")
      .select("tip")
      .eq("match_id", id)
      .eq("user_id", user.id)
      .then(({ data }) => {
        const k = { elli: false, sure: false };
        (data ?? []).forEach((j) => (k[j.tip] = true));
        setJokerKullanildi(k);
      });
  }, [id, user.id]);

  const jokerKullan = async (tip) => {
    setJokerHata(null);
    const { data, error } = await supabase.rpc("use_joker", {
      p_match_id: id,
      p_tip: tip,
    });
    if (error) {
      setJokerHata(error.message);
      return null;
    }
    setJokerKullanildi((k) => ({ ...k, [tip]: true }));
    refreshProfile(user.id);
    return data;
  };

  const macYukle = useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select(MAC_SECIMI)
      .eq("id", id)
      .single();
    if (data) setMac(data);
    return data;
  }, [id]);

  useEffect(() => {
    macYukle();
    const kanal = supabase
      .channel(`mac-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${id}` },
        (payload) => setMac((eski) => ({ ...eski, ...payload.new }))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=eq.${id}` },
        (payload) => balonGoster(payload.new.user_id, payload.new.mesaj)
      )
      .subscribe();
    // Realtime kopsa bile skor akmaya devam etsin (rakip puanı canlı artar)
    pollRef.current = setInterval(macYukle, 2000);
    return () => {
      supabase.removeChannel(kanal);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, macYukle, balonGoster]);

  // Soru değişince çek
  useEffect(() => {
    if (!mac || mac.durum !== "aktif" || mac.aktif_soru < 0) {
      setSoru(null);
      return;
    }
    advanceKilidi.current = false;
    setCevapladim(false);
    if (pollRef.current) clearInterval(pollRef.current);
    supabase
      .rpc("get_match_question", { p_match_id: mac.id })
      .then(({ data, error }) => {
        if (!error && data?.[0]) setSoru(data[0]);
      });
  }, [mac?.id, mac?.durum, mac?.aktif_soru, mac?.soru_baslangic]);

  useOyunModu(Boolean(soru) && mac?.durum === "aktif");

  // Maç bitince puan tazele
  useEffect(() => {
    if (mac?.durum === "bitti") {
      refreshProfile(user.id);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [mac?.durum, refreshProfile, user.id]);

  const ilerletmeyiDene = useCallback(() => {
    supabase.rpc("advance_match", { p_match_id: id }).then(() => macYukle());
  }, [id, macYukle]);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_match_answer", {
      p_match_id: id,
      p_cevap: i,
    });
    if (error) throw error;
    setCevapladim(true);
    // Rakip de cevapladıysa erken ilerlesin diye periyodik kontrol
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(ilerletmeyiDene, 2500);
    return data?.[0];
  };

  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current) return;
    advanceKilidi.current = true;
    setTimeout(ilerletmeyiDene, Math.random() * 800 + 1000);
  }, [ilerletmeyiDene]);

  if (!mac) return <div className="yukleniyor">Yükleniyor…</div>;

  const benP1 = mac.oyuncu1 === user.id;
  const benimSkor = benP1 ? mac.oyuncu1_skor : mac.oyuncu2_skor;
  const rakipSkor = benP1 ? mac.oyuncu2_skor : mac.oyuncu1_skor;
  const rakipProfil = benP1 ? mac.p2 : mac.p1;
  const benimProfil = benP1 ? mac.p1 : mac.p2;

  if (mac.durum === "bekliyor") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji">⏳</div>
        <h2>Cevap bekleniyor</h2>
        <p className="alt-yazi">{rakipProfil?.gorunen_ad} henüz kabul etmedi.</p>
      </div>
    );
  }

  if (mac.durum === "reddedildi" || mac.durum === "iptal") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji">🙅</div>
        <h2>Meydan okuma reddedildi</h2>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/bildim/meydan")}>
          ← Geri dön
        </button>
      </div>
    );
  }

  if (mac.durum === "bitti") {
    const kazandim = mac.kazanan === user.id;
    const berabere = mac.kazanan === null;
    return (
      <div className="buyuk-mesaj">
        <div className="emoji">{berabere ? "🤝" : kazandim ? "🎉" : "😢"}</div>
        <h2>
          {berabere ? "Berabere!" : kazandim ? "Kazandın! +20 puan" : "Kaybettin"}
        </h2>
        <div className="skor-tabela" style={{ marginTop: 20 }}>
          <div className="taraf">
            <div className="isim">{benimProfil?.gorunen_ad} (sen)</div>
            <div className="skor">{benimSkor}</div>
          </div>
          <div className="vs">VS</div>
          <div className="taraf">
            <div className="isim">{rakipProfil?.gorunen_ad}</div>
            <div className="skor">{rakipSkor}</div>
          </div>
        </div>
        <MacSonuEklentisi macTur="1v1" macId={id} kaybettim={!kazandim && !berabere} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "20px auto 0" }}>
          <button
            className="btn"
            onClick={async () => {
              const { data, error } = await supabase.rpc("create_challenge", {
                p_rakip: rakipProfil.id,
                p_kategori: mac.kategori,
              });
              if (!error && data) navigate(`/bildim/mac/${data}`);
              else navigate("/bildim/meydan");
            }}
          >
            🔁 Rövanş
          </button>
          {(() => {
            const sonucYazi = berabere
              ? `${rakipProfil?.gorunen_ad} ile ${benimSkor}-${rakipSkor} berabere kaldım`
              : kazandim
                ? `${rakipProfil?.gorunen_ad}'i ${benimSkor}-${rakipSkor} yendim! 🏆`
                : `${rakipProfil?.gorunen_ad} karşısında kıl payı kaybettim`;
            const mesaj = `🧠 Bildim!'de ${sonucYazi} Sen de gel, kapışalım: ${window.location.origin}/?davet=${user.id}`;
            const enc = encodeURIComponent(mesaj);
            return (
              <div className="paylas-bar">
                <a
                  className="paylas wa"
                  href={`https://wa.me/?text=${enc}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp
                </a>
                <a
                  className="paylas x"
                  href={`https://twitter.com/intent/tweet?text=${enc}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  𝕏 Paylaş
                </a>
                <button
                  className="paylas diger"
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: "Bildim!", text: mesaj });
                      } catch { /* vazgeçti */ }
                    } else {
                      await navigator.clipboard.writeText(mesaj);
                    }
                  }}
                >
                  📤 Diğer
                </button>
              </div>
            );
          })()}
          {/* Bildirim izni ilk açılışta değil, ilk maç sonucunda sorulur. */}
          <BildirimIzniSor />
          <button className="btn ikincil" onClick={() => navigate("/bildim/meydan")}>
            ← Meydan okumalara dön
          </button>
        </div>
      </div>
    );
  }

  // Aktif maç
  return (
    <div>
      <div className="skor-tabela">
        <div className="taraf">
          <div className="isim">{benimProfil?.gorunen_ad} (sen)</div>
          <div className="skor">{benimSkor}</div>
        </div>
        <div className="vs">
          {mac.aktif_soru + 1}/{mac.soru_ids?.length ?? 5}
        </div>
        <div className="taraf">
          <div className="isim">{rakipProfil?.gorunen_ad}</div>
          <div className="skor">{rakipSkor}</div>
        </div>
      </div>

      {(balonlar[user.id] || balonlar[rakipProfil?.id]) && (
        <div className="balon-satir">
          <div className="balon-yuva">
            {balonlar[user.id] && <div className="balon">{balonlar[user.id]}</div>}
          </div>
          <div className="balon-yuva sag">
            {balonlar[rakipProfil?.id] && (
              <div className="balon rakip">{balonlar[rakipProfil?.id]}</div>
            )}
          </div>
        </div>
      )}

      <div className="sohbet-bar">
        {EMOJILER.map((e) => (
          <button key={e} onClick={() => mesajGonder(e)}>
            {e}
          </button>
        ))}
        <button
          className={kaliplarAcik ? "acik" : ""}
          onClick={() => setKaliplarAcik((a) => !a)}
        >
          💬
        </button>
      </div>
      {kaliplarAcik && (
        <div className="kalip-liste">
          {KALIPLAR.map((k) => (
            <button key={k} onClick={() => mesajGonder(k)}>
              {k}
            </button>
          ))}
        </div>
      )}

      {jokerHata && <div className="hata-kutu">{jokerHata}</div>}

      {soru && (
        <QuestionCard
          key={`${mac.id}-${mac.aktif_soru}`}
          soru={soru}
          onCevapla={cevapla}
          onSureDoldu={sureDoldu}
          macTur={"1v1"}
          macId={id}
        />
      )}

      {cevapladim && (
        <div className="alt-yazi" style={{ textAlign: "center", marginTop: 14 }}>
          Rakibin cevaplaması bekleniyor…
        </div>
      )}
    </div>
  );
}
