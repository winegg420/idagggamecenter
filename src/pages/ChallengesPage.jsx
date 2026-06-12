import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, username, avatar_url, puan),
  p2:profiles!matches_oyuncu2_fkey(id, username, avatar_url, puan)`;

const botZorluk = (isabet) =>
  isabet <= 0.45
    ? { etiket: "Kolay", renk: "var(--success)" }
    : isabet <= 0.75
      ? { etiket: "Orta", renk: "var(--accent)" }
      : { etiket: "Zor", renk: "var(--danger)" };

export default function ChallengesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [maclar, setMaclar] = useState([]);
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [hata, setHata] = useState(null);
  const [botlar, setBotlar] = useState([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, avatar_url, puan, bot_isabet")
      .eq("is_bot", true)
      .order("bot_isabet", { ascending: true })
      .then(({ data }) => setBotlar(data ?? []));
  }, []);

  const yukle = useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select(MAC_SECIMI)
      .or(`oyuncu1.eq.${user.id},oyuncu2.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30);
    setMaclar(data ?? []);
  }, [user.id]);

  useEffect(() => {
    yukle();
    const kanal = supabase
      .channel("maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, yukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [yukle]);

  const ara = async (q) => {
    setArama(q);
    if (q.trim().length < 2) {
      setSonuclar([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, puan")
      .ilike("username", `%${q.trim()}%`)
      .neq("id", user.id)
      .limit(8);
    setSonuclar(data ?? []);
  };

  const meydanOku = async (hedefId) => {
    setHata(null);
    const { error } = await supabase.rpc("create_challenge", { p_rakip: hedefId });
    if (error) setHata(error.message);
    else {
      setArama("");
      setSonuclar([]);
      yukle();
    }
  };

  const cevapVer = async (macId, kabul) => {
    setHata(null);
    const { error } = await supabase.rpc("respond_challenge", {
      p_match_id: macId,
      p_kabul: kabul,
    });
    if (error) setHata(error.message);
    else if (kabul) navigate(`/mac/${macId}`);
    else yukle();
  };

  const gelen = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu2 === user.id);
  const giden = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu1 === user.id);
  const aktif = maclar.filter((m) => m.durum === "aktif");
  const biten = maclar.filter((m) => m.durum === "bitti").slice(0, 10);

  const rakip = (m) => (m.oyuncu1 === user.id ? m.p2 : m.p1);

  return (
    <div>
      <div className="baslik">⚔️ Meydan Okuma</div>
      {hata && <div className="hata-kutu">{hata}</div>}

      {botlar
        .filter(
          (b) =>
            !maclar.some(
              (m) =>
                (m.oyuncu1 === b.id || m.oyuncu2 === b.id) &&
                ["bekliyor", "aktif"].includes(m.durum)
            )
        )
        .map((b) => {
          const z = botZorluk(b.bot_isabet);
          return (
            <div key={b.id} className="liste-satir">
              <Avatar profile={b} />
              <div className="bilgi">
                <div className="isim">{b.username} 🤖</div>
                <div className="detay">
                  Zorluk: <span style={{ color: z.renk, fontWeight: 700 }}>{z.etiket}</span> · her zaman hazır
                </div>
              </div>
              <button className="btn kucuk" onClick={() => meydanOku(b.id)}>
                ⚔️ Meydan Oku
              </button>
            </div>
          );
        })}

      <div className="kart">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Rakip bul</div>
        <input
          type="text"
          placeholder="Kullanıcı adı ara…"
          value={arama}
          onChange={(e) => ara(e.target.value)}
        />
        {sonuclar.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <Avatar profile={p} boyut={34} />
            <span style={{ flex: 1, fontWeight: 600 }}>{p.username}</span>
            <button className="btn kucuk" onClick={() => meydanOku(p.id)}>
              ⚔️ Meydan Oku
            </button>
          </div>
        ))}
      </div>

      {gelen.length > 0 && (
        <>
          <div className="baslik">📥 Sana Gelen ({gelen.length})</div>
          {gelen.map((m) => (
            <div key={m.id} className="liste-satir">
              <Avatar profile={m.p1} />
              <div className="bilgi">
                <div className="isim">{m.p1?.username}</div>
                <div className="detay">sana meydan okudu!</div>
              </div>
              <button className="btn kucuk" onClick={() => cevapVer(m.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => cevapVer(m.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      {aktif.length > 0 && (
        <>
          <div className="baslik">🎮 Devam Eden</div>
          {aktif.map((m) => (
            <div key={m.id} className="liste-satir">
              <Avatar profile={rakip(m)} />
              <div className="bilgi">
                <div className="isim">{rakip(m)?.username}</div>
                <div className="detay">
                  {m.oyuncu1_skor} - {m.oyuncu2_skor}
                </div>
              </div>
              <button className="btn kucuk" onClick={() => navigate(`/mac/${m.id}`)}>
                Oyna →
              </button>
            </div>
          ))}
        </>
      )}

      {giden.length > 0 && (
        <>
          <div className="baslik">📤 Gönderdiğin</div>
          {giden.map((m) => (
            <div key={m.id} className="liste-satir">
              <Avatar profile={m.p2} />
              <div className="bilgi">
                <div className="isim">{m.p2?.username}</div>
                <div className="detay">cevap bekleniyor…</div>
              </div>
            </div>
          ))}
        </>
      )}

      {biten.length > 0 && (
        <>
          <div className="baslik">🏁 Bitenler</div>
          {biten.map((m) => {
            const kazandim = m.kazanan === user.id;
            const berabere = m.kazanan === null;
            return (
              <div key={m.id} className="liste-satir">
                <Avatar profile={rakip(m)} />
                <div className="bilgi">
                  <div className="isim">{rakip(m)?.username}</div>
                  <div className="detay">
                    {m.oyuncu1_skor} - {m.oyuncu2_skor}
                  </div>
                </div>
                <span
                  className="rutbe-chip"
                  style={{
                    color: berabere
                      ? "var(--text-dim)"
                      : kazandim
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {berabere ? "Berabere" : kazandim ? "Kazandın +20" : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
