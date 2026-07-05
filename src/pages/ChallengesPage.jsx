import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, username, avatar_url, puan),
  p2:profiles!matches_oyuncu2_fkey(id, username, avatar_url, puan)`;

const GRUP_SECIMI = `*,
  katilimcilar:group_match_players(group_match_id, user_id, davet_durumu, skor,
    profil:profiles(id, username, avatar_url, puan))`;

const HIZLI_SECIMI = `*,
  katilimcilar:hizli_oyuncular(hizli_mac_id, user_id, davet_durumu, skor,
    profil:profiles(id, username, avatar_url, puan))`;

const botZorluk = (isabet) =>
  isabet <= 0.45
    ? { etiket: "Kolay", renk: "var(--success)" }
    : isabet <= 0.75
      ? { etiket: "Orta", renk: "var(--accent)" }
      : { etiket: "Zor", renk: "var(--danger)" };

const KATEGORI_ETIKET = {
  genel: "🎲 Genel",
  bilim: "🔬 Bilim",
  cografya: "🌍 Coğrafya",
  tarih: "🏛️ Tarih",
  edebiyat: "📚 Edebiyat",
  spor: "⚽ Spor",
  sanat: "🎨 Sanat",
};

export default function ChallengesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [maclar, setMaclar] = useState([]);
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [hata, setHata] = useState(null);
  const [botlar, setBotlar] = useState([]);
  const [oyuncular, setOyuncular] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [kategori, setKategori] = useState(null); // null = karışık
  const [grupMaclar, setGrupMaclar] = useState([]);
  const [grupOyuncuSayisi, setGrupOyuncuSayisi] = useState(3);
  const [grupSecili, setGrupSecili] = useState([]);
  const [grupHata, setGrupHata] = useState(null);
  const [hizliMaclar, setHizliMaclar] = useState([]);
  const [hizliSecili, setHizliSecili] = useState([]);
  const [hizliHata, setHizliHata] = useState(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, avatar_url, puan, bot_isabet")
      .eq("is_bot", true)
      .order("bot_isabet", { ascending: true })
      .then(({ data }) => setBotlar(data ?? []));
    supabase
      .from("profiles")
      .select("id, username, avatar_url, puan")
      .eq("is_bot", false)
      .neq("id", user.id)
      .order("puan", { ascending: false })
      .limit(20)
      .then(({ data }) => setOyuncular(data ?? []));
    supabase
      .rpc("get_categories")
      .then(({ data }) => setKategoriler(data ?? []));
  }, [user.id]);

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

  const grupYukle = useCallback(async () => {
    const { data } = await supabase
      .from("group_matches")
      .select(GRUP_SECIMI)
      .order("created_at", { ascending: false })
      .limit(20);
    setGrupMaclar(data ?? []);
  }, []);

  useEffect(() => {
    grupYukle();
    const kanal = supabase
      .channel("grup_maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_matches" }, grupYukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_match_players" }, grupYukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [grupYukle]);

  const hizliYukle = useCallback(async () => {
    const { data } = await supabase
      .from("hizli_maclar")
      .select(HIZLI_SECIMI)
      .order("created_at", { ascending: false })
      .limit(20);
    setHizliMaclar(data ?? []);
  }, []);

  useEffect(() => {
    hizliYukle();
    const kanal = supabase
      .channel("hizli_maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "hizli_maclar" }, hizliYukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "hizli_oyuncular" }, hizliYukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [hizliYukle]);

  const aramaNo = useRef(0);
  const ara = async (q) => {
    setArama(q);
    const istek = ++aramaNo.current;
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
    // Geciken eski istek, daha yeni sonuçların üzerine yazmasın
    if (istek === aramaNo.current) setSonuclar(data ?? []);
  };

  const meydanOku = async (hedefId) => {
    setHata(null);
    const { error } = await supabase.rpc("create_challenge", {
      p_rakip: hedefId,
      p_kategori: kategori,
    });
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

  const grupAday = [
    ...botlar,
    ...oyuncular.filter((o) => !botlar.some((b) => b.id === o.id)),
  ];
  const grupGerekli = grupOyuncuSayisi - 1;

  const grupSecimToggle = (id) => {
    setGrupSecili((secili) => {
      if (secili.includes(id)) return secili.filter((s) => s !== id);
      if (secili.length >= grupGerekli) return secili;
      return [...secili, id];
    });
  };

  const grubuKur = async () => {
    setGrupHata(null);
    const { data, error } = await supabase.rpc("create_group_challenge", {
      p_rakipler: grupSecili,
      p_kategori: kategori,
    });
    if (error) setGrupHata(error.message);
    else {
      setGrupSecili([]);
      navigate(`/grup-mac/${data}`);
    }
  };

  const grupCevapVer = async (grupMacId, kabul) => {
    setGrupHata(null);
    const { error } = await supabase.rpc("respond_group_challenge", {
      p_group_match_id: grupMacId,
      p_kabul: kabul,
    });
    if (error) setGrupHata(error.message);
    else if (kabul) navigate(`/grup-mac/${grupMacId}`);
    else grupYukle();
  };

  const hizliGerekli = 4;

  const hizliSecimToggle = (id) => {
    setHizliSecili((secili) => {
      if (secili.includes(id)) return secili.filter((s) => s !== id);
      if (secili.length >= hizliGerekli) return secili;
      return [...secili, id];
    });
  };

  const hizliKur = async () => {
    setHizliHata(null);
    const { data, error } = await supabase.rpc("create_hizli_mac", {
      p_rakipler: hizliSecili,
      p_kategori: kategori,
    });
    if (error) setHizliHata(error.message);
    else {
      setHizliSecili([]);
      navigate(`/hizli-mac/${data}`);
    }
  };

  const hizliCevapVer = async (hizliMacId, kabul) => {
    setHizliHata(null);
    const { error } = await supabase.rpc("respond_hizli_davet", {
      p_hizli_mac_id: hizliMacId,
      p_kabul: kabul,
    });
    if (error) setHizliHata(error.message);
    else if (kabul) navigate(`/hizli-mac/${hizliMacId}`);
    else hizliYukle();
  };

  const hizliBenimKaydim = (hm) => hm.katilimcilar?.find((k) => k.user_id === user.id);
  const hizliGelen = hizliMaclar.filter(
    (hm) => hm.durum === "bekliyor" && hizliBenimKaydim(hm)?.davet_durumu === "bekliyor"
  );
  const hizliAktif = hizliMaclar.filter((hm) => hm.durum === "aktif" && hizliBenimKaydim(hm));
  const hizliBeklenen = hizliMaclar.filter(
    (hm) => hm.durum === "bekliyor" && hizliBenimKaydim(hm)?.davet_durumu === "kabul" && hm.kurucu === user.id
  );
  const hizliBiten = hizliMaclar
    .filter((hm) => hm.durum === "bitti" && hizliBenimKaydim(hm))
    .slice(0, 10);

  const grupBenimKaydim = (gm) => gm.katilimcilar?.find((k) => k.user_id === user.id);
  const grupGelen = grupMaclar.filter(
    (gm) => gm.durum === "bekliyor" && grupBenimKaydim(gm)?.davet_durumu === "bekliyor"
  );
  const grupAktif = grupMaclar.filter((gm) => gm.durum === "aktif" && grupBenimKaydim(gm));
  const grupBeklenen = grupMaclar.filter(
    (gm) => gm.durum === "bekliyor" && grupBenimKaydim(gm)?.davet_durumu === "kabul" && gm.kurucu === user.id
  );
  const grupBiten = grupMaclar
    .filter((gm) => gm.durum === "bitti" && grupBenimKaydim(gm))
    .slice(0, 10);

  const gelen = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu2 === user.id);
  const giden = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu1 === user.id);
  const aktif = maclar.filter((m) => m.durum === "aktif");
  const biten = maclar.filter((m) => m.durum === "bitti").slice(0, 10);

  const rakip = (m) => (m.oyuncu1 === user.id ? m.p2 : m.p1);

  return (
    <div>
      <div className="baslik">⚔️ Meydan Okuma</div>
      {hata && <div className="hata-kutu">{hata}</div>}

      <div className="kategori-cips">
        <button
          className={`cip ${kategori === null ? "aktif" : ""}`}
          onClick={() => setKategori(null)}
        >
          🎯 Karışık
        </button>
        {kategoriler.map((k) => (
          <button
            key={k.kategori}
            className={`cip ${kategori === k.kategori ? "aktif" : ""}`}
            onClick={() => setKategori(k.kategori)}
          >
            {KATEGORI_ETIKET[k.kategori] ?? k.kategori}
          </button>
        ))}
      </div>

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

      <div className="kart">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>👨‍👩‍👧‍👦 Grup Meydan Okuma (3-5 kişi)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[3, 4, 5].map((n) => (
            <button
              key={n}
              className={`oyuncu-secim-cip ${grupOyuncuSayisi === n ? "secili" : ""}`}
              onClick={() => {
                setGrupOyuncuSayisi(n);
                setGrupSecili((s) => s.slice(0, n - 1));
              }}
            >
              {n} Kişi
            </button>
          ))}
        </div>
        <div className="alt-yazi" style={{ marginBottom: 8 }}>
          {grupSecili.length}/{grupGerekli} rakip seçildi (botlar dahil)
        </div>
        <div>
          {grupAday.map((p) => {
            const secili = grupSecili.includes(p.id);
            const dolu = !secili && grupSecili.length >= grupGerekli;
            return (
              <button
                key={p.id}
                className={`oyuncu-secim-cip ${secili ? "secili" : ""}`}
                disabled={dolu}
                onClick={() => grupSecimToggle(p.id)}
              >
                {p.username}
                {p.bot_isabet != null && " 🤖"}
              </button>
            );
          })}
        </div>
        {grupHata && <div className="hata-kutu" style={{ marginTop: 10 }}>{grupHata}</div>}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={grupSecili.length !== grupGerekli}
          onClick={grubuKur}
        >
          🚀 Grubu Kur ve Davet Et
        </button>
      </div>

      <div className="kart">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>⚡ Hızlı Olan Kazanır (5 kişi)</div>
        <div className="alt-yazi" style={{ marginBottom: 10 }}>
          Herkese aynı soru aynı anda. Sadece <b>ilk doğru cevabı</b> veren puan alır. Joker yok!
        </div>
        <div className="alt-yazi" style={{ marginBottom: 8 }}>
          {hizliSecili.length}/{hizliGerekli} rakip seçildi (botlar dahil)
        </div>
        <div>
          {grupAday.map((p) => {
            const secili = hizliSecili.includes(p.id);
            const dolu = !secili && hizliSecili.length >= hizliGerekli;
            return (
              <button
                key={p.id}
                className={`oyuncu-secim-cip ${secili ? "secili" : ""}`}
                disabled={dolu}
                onClick={() => hizliSecimToggle(p.id)}
              >
                {p.username}
                {p.bot_isabet != null && " 🤖"}
              </button>
            );
          })}
        </div>
        {hizliHata && <div className="hata-kutu" style={{ marginTop: 10 }}>{hizliHata}</div>}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={hizliSecili.length !== hizliGerekli}
          onClick={hizliKur}
        >
          ⚡ Yarışı Kur ve Davet Et
        </button>
      </div>

      {oyuncular.length > 0 && (
        <>
          <div className="baslik">🧑‍🤝‍🧑 Oyuncular</div>
          {oyuncular.map((p) => {
            const mevcutMac = maclar.some(
              (m) =>
                (m.oyuncu1 === p.id || m.oyuncu2 === p.id) &&
                ["bekliyor", "aktif"].includes(m.durum)
            );
            return (
              <div key={p.id} className="liste-satir">
                <Avatar profile={p} boyut={38} />
                <div className="bilgi">
                  <div className="isim">{p.username}</div>
                  <div className="detay">⭐ {p.puan}</div>
                </div>
                {!mevcutMac && (
                  <button className="btn kucuk" onClick={() => meydanOku(p.id)}>
                    ⚔️ Meydan Oku
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

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

      {hizliGelen.length > 0 && (
        <>
          <div className="baslik">⚡ Hızlı Yarış Davetlerin ({hizliGelen.length})</div>
          {hizliGelen.map((hm) => (
            <div key={hm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {hm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.username)
                    .join(", ")}
                </div>
                <div className="detay">Hızlı Olan Kazanır — 5 kişilik yarış</div>
              </div>
              <button className="btn kucuk" onClick={() => hizliCevapVer(hm.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => hizliCevapVer(hm.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      {hizliBeklenen.length > 0 && (
        <>
          <div className="baslik">📤 Kurduğun Yarışlar (yanıt bekleniyor)</div>
          {hizliBeklenen.map((hm) => (
            <div key={hm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {hm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => `${k.profil?.username} (${k.davet_durumu === "kabul" ? "hazır" : "bekliyor"})`)
                    .join(", ")}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {hizliAktif.length > 0 && (
        <>
          <div className="baslik">⚡ Devam Eden Hızlı Yarışlar</div>
          {hizliAktif.map((hm) => (
            <div key={hm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {hm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.username)
                    .join(", ")}
                </div>
                <div className="detay">Hızlı Olan Kazanır</div>
              </div>
              <button className="btn kucuk" onClick={() => navigate(`/hizli-mac/${hm.id}`)}>
                Oyna →
              </button>
            </div>
          ))}
        </>
      )}

      {hizliBiten.length > 0 && (
        <>
          <div className="baslik">🏁 Biten Hızlı Yarışlar</div>
          {hizliBiten.map((hm) => {
            const kazandim = hm.kazanan === user.id;
            const berabere = hm.kazanan === null;
            return (
              <div key={hm.id} className="liste-satir">
                <div className="bilgi">
                  <div className="isim">
                    {hm.katilimcilar
                      ?.filter((k) => k.user_id !== user.id)
                      .map((k) => `${k.profil?.username} (${k.skor})`)
                      .join(", ")}
                  </div>
                  <div className="detay">senin skorun: {hizliBenimKaydim(hm)?.skor ?? 0}</div>
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
                  {berabere ? "Berabere" : kazandim ? "Kazandın +50" : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}

      {grupGelen.length > 0 && (
        <>
          <div className="baslik">📥 Grup Davetlerin ({grupGelen.length})</div>
          {grupGelen.map((gm) => (
            <div key={gm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {gm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.username)
                    .join(", ")}
                </div>
                <div className="detay">{gm.oyuncu_sayisi} kişilik gruba davet edildin</div>
              </div>
              <button className="btn kucuk" onClick={() => grupCevapVer(gm.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => grupCevapVer(gm.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      {grupBeklenen.length > 0 && (
        <>
          <div className="baslik">📤 Kurduğun Gruplar (yanıt bekleniyor)</div>
          {grupBeklenen.map((gm) => (
            <div key={gm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {gm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => `${k.profil?.username} (${k.davet_durumu === "kabul" ? "hazır" : "bekliyor"})`)
                    .join(", ")}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {grupAktif.length > 0 && (
        <>
          <div className="baslik">🎮 Devam Eden Grup Maçları</div>
          {grupAktif.map((gm) => (
            <div key={gm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {gm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.username)
                    .join(", ")}
                </div>
                <div className="detay">{gm.oyuncu_sayisi} kişilik grup maçı</div>
              </div>
              <button className="btn kucuk" onClick={() => navigate(`/grup-mac/${gm.id}`)}>
                Oyna →
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

      {grupBiten.length > 0 && (
        <>
          <div className="baslik">🏁 Biten Grup Maçları</div>
          {grupBiten.map((gm) => {
            const kazandim = gm.kazanan === user.id;
            const berabere = gm.kazanan === null;
            const odul = 10 * gm.oyuncu_sayisi;
            return (
              <div key={gm.id} className="liste-satir">
                <div className="bilgi">
                  <div className="isim">
                    {gm.katilimcilar
                      ?.filter((k) => k.user_id !== user.id)
                      .map((k) => `${k.profil?.username} (${k.skor})`)
                      .join(", ")}
                  </div>
                  <div className="detay">senin skorun: {grupBenimKaydim(gm)?.skor ?? 0}</div>
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
                  {berabere ? "Berabere" : kazandim ? `Kazandın +${odul}` : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
