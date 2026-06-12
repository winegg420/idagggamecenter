import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import QuestionCard from "../components/QuestionCard.jsx";

const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, username, avatar_url),
  p2:profiles!matches_oyuncu2_fkey(id, username, avatar_url)`;

export default function MatchPage() {
  const { id } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mac, setMac] = useState(null);
  const [soru, setSoru] = useState(null);
  const [cevapladim, setCevapladim] = useState(false);
  const [jokerKullanildi, setJokerKullanildi] = useState({ elli: false, sure: false });
  const [jokerHata, setJokerHata] = useState(null);
  const advanceKilidi = useRef(false);
  const pollRef = useRef(null);

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
      .subscribe();
    return () => {
      supabase.removeChannel(kanal);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, macYukle]);

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
        <p className="alt-yazi">{rakipProfil?.username} henüz kabul etmedi.</p>
      </div>
    );
  }

  if (mac.durum === "reddedildi" || mac.durum === "iptal") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji">🙅</div>
        <h2>Meydan okuma reddedildi</h2>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/meydan")}>
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
            <div className="isim">{benimProfil?.username} (sen)</div>
            <div className="skor">{benimSkor}</div>
          </div>
          <div className="vs">VS</div>
          <div className="taraf">
            <div className="isim">{rakipProfil?.username}</div>
            <div className="skor">{rakipSkor}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "20px auto 0" }}>
          <button
            className="btn"
            onClick={async () => {
              const { data, error } = await supabase.rpc("create_challenge", {
                p_rakip: rakipProfil.id,
                p_kategori: mac.kategori,
              });
              if (!error && data) navigate(`/mac/${data}`);
              else navigate("/meydan");
            }}
          >
            🔁 Rövanş
          </button>
          <button className="btn ikincil" onClick={() => navigate("/meydan")}>
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
          <div className="isim">{benimProfil?.username} (sen)</div>
          <div className="skor">{benimSkor}</div>
        </div>
        <div className="vs">
          {mac.aktif_soru + 1}/{mac.soru_ids?.length ?? 5}
        </div>
        <div className="taraf">
          <div className="isim">{rakipProfil?.username}</div>
          <div className="skor">{rakipSkor}</div>
        </div>
      </div>

      {jokerHata && <div className="hata-kutu">{jokerHata}</div>}

      {soru && (
        <QuestionCard
          key={`${mac.id}-${mac.aktif_soru}`}
          soru={soru}
          onCevapla={cevapla}
          onSureDoldu={sureDoldu}
          jokerler={{ kullanildi: jokerKullanildi, onKullan: jokerKullan }}
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
