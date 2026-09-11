import { useCallback, useEffect, useRef, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { TEPKILER, tepkiIkonu } from "../lib/tepkiler.js";
import SenRozeti from "../components/SenRozeti.jsx";
import YanlisSatiri from "../components/YanlisSatiri.jsx";
import SureDolduGecis from "../components/SureDolduGecis.jsx";
import MacYukleniyor from "../components/MacYukleniyor.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useOyunModu } from "../lib/oyunModu.js";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import { y } from "../lib/yol.js";
import { useGorunurlukTazele } from "../lib/gorunurluk.js";

const GRUP_SECIMI = `*,
  katilimcilar:group_match_players(group_match_id, user_id, davet_durumu, skor, joined_at,
    profil:profiles(id, gorunen_ad, gorunen_avatar))`;

// Tepkiler artık SVG ikon (bkz. lib/tepkiler.js). Sunucuya giden metin aynı.
// Balonda gösterim: mesaj bir tepki emojisiyse ikonu, değilse metni çiz.
function balonIcerik(mesaj) {
  const ad = tepkiIkonu(mesaj);
  return ad ? <Ikon ad={ad} boyut={20} /> : mesaj;
}
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

export default function GroupMatchPage() {
  const { id } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mac, setMac] = useState(null);
  const [yuklemeHatasi, setYuklemeHatasi] = useState(null);
  const [soru, setSoru] = useState(null);
  const [cevapladim, setCevapladim] = useState(false);
  const [jokerKullanildi, setJokerKullanildi] = useState({ elli: false, sure: false });
  const [jokerHata, setJokerHata] = useState(null);
  const [balonlar, setBalonlar] = useState({}); // { [user_id]: mesaj }
  const [kaliplarAcik, setKaliplarAcik] = useState(false);
  const advanceKilidi = useRef(false);
  const pollRef = useRef(null);
  const kanalRef = useRef(null);
  // Maç bitişinde sonuç ekranından önce 0.8 sn'lik "Maç bitti!" perdesi
  const [gecisBitti, setGecisBitti] = useState(false);
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
    await supabase.rpc("send_group_match_message", { p_group_match_id: id, p_mesaj: mesaj });
  };

  useEffect(() => {
    supabase
      .from("group_match_jokers")
      .select("tip")
      .eq("group_match_id", id)
      .eq("user_id", user.id)
      .then(({ data }) => {
        const k = { elli: false, sure: false };
        (data ?? []).forEach((j) => (k[j.tip] = true));
        setJokerKullanildi(k);
      });
  }, [id, user.id]);

  const jokerKullan = async (tip) => {
    setJokerHata(null);
    const { data, error } = await supabase.rpc("use_group_joker", {
      p_group_match_id: id,
      p_tip: tip,
    });
    if (error) {
      setJokerHata(hataMesaji(error));
      return null;
    }
    setJokerKullanildi((k) => ({ ...k, [tip]: true }));
    refreshProfile(user.id);
    return data;
  };

  const macYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("group_matches")
        .select(GRUP_SECIMI)
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data) {
        setMac(data);
        setYuklemeHatasi(null);
      }
      return data;
    } catch (e) {
      console.error("[Bildim] grup maci yuklenemedi:", e);
      setYuklemeHatasi(hataMesaji(e, "Maç bilgisi alınamadı."));
      return null;
    }
  }, [id]);

  const maciIptalEt = useCallback(async () => {
    try {
      await supabase.rpc("grup_mac_iptal", { p_group_match_id: id });
    } catch (e) {
      console.error("[Bildim] grup mac iptal:", e);
    }
    navigate(y("/meydan"));
  }, [id, navigate]);

  // Kanal kurulumu ayrı fonksiyonda: sekmeden dönüşte ölmüş soket yeniden kurulur.
  const kanalKur = useCallback(() => {
    const kanal = supabase
      .channel(`grup-mac-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_matches", filter: `id=eq.${id}` },
        () => macYukle()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_match_players", filter: `group_match_id=eq.${id}` },
        () => macYukle()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_match_messages", filter: `group_match_id=eq.${id}` },
        (payload) => balonGoster(payload.new.user_id, payload.new.mesaj)
      )
      .subscribe();
    kanalRef.current = kanal;
    return kanal;
  }, [id, macYukle, balonGoster]);

  useEffect(() => {
    macYukle();
    kanalKur();
    return () => {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, macYukle, kanalKur]);

  // Sekmeden dönünce: sunucudaki güncel durumu çek + Realtime kanalını yenile.
  // Ortak soru saati olduğu için istemci ekstra atlama tetiklemez; sunucudaki
  // aktif_soru neyse oradan devam edilir.
  useGorunurlukTazele(() => {
    macYukle();
    try {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalKur();
    } catch (e) {
      console.error('[Bildim] realtime yeniden kurulamadi:', e);
    }
  }, mac?.durum === 'aktif');

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
      .rpc("get_group_match_question", { p_group_match_id: mac.id })
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
    supabase.rpc("advance_group_match", { p_group_match_id: id }).then(() => macYukle());
  }, [id, macYukle]);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_group_match_answer", {
      p_group_match_id: id,
      p_cevap: i,
    });
    if (error) throw error;
    setCevapladim(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(ilerletmeyiDene, 2500);
    return data?.[0];
  };

  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current) return;
    advanceKilidi.current = true;
    setTimeout(ilerletmeyiDene, Math.random() * 800 + 1000);
  }, [ilerletmeyiDene]);

  const cevapVer = async (kabul) => {
    const { error } = await supabase.rpc("respond_group_challenge", {
      p_group_match_id: id,
      p_kabul: kabul,
    });
    if (!error) macYukle();
  };

  useOyunModu(Boolean(soru) && mac?.durum === "aktif");

  if (!mac) {
    return (
      <MacYukleniyor
        hata={yuklemeHatasi}
        onTekrarDene={() => { setYuklemeHatasi(null); macYukle(); }}
        onIptal={maciIptalEt}
      />
    );
  }

  const katilimcilar = mac.katilimcilar ?? [];
  const benimKayit = katilimcilar.find((k) => k.user_id === user.id);
  const siraliSkor = [...katilimcilar]
    .filter((k) => k.davet_durumu === "kabul")
    .sort((a, b) => b.skor - a.skor);

  if (mac.durum === "bekliyor") {
    const bekleyenler = katilimcilar.filter((k) => k.davet_durumu === "bekliyor");
    return (
      <div className="buyuk-mesaj">
        <div className="emoji"><Ikon ad="saat" boyut={44} /></div>
        <h2>Grup maçı bekleniyor</h2>
        <p className="alt-yazi" style={{ marginBottom: 16 }}>
          {bekleyenler.length > 0
            ? `${bekleyenler.map((b) => b.profil?.gorunen_ad).join(", ")} henüz kabul etmedi.`
            : "Herkes hazır olunca maç otomatik başlayacak."}
        </p>
        <div className="kart" style={{ maxWidth: 340, margin: "0 auto" }}>
          {katilimcilar.map((k) => (
            <div key={k.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <Avatar profile={k.profil} boyut={34} />
              <span style={{ flex: 1, fontWeight: 600, textAlign: "left" }}>
                {k.profil?.gorunen_ad}{k.user_id === user.id && <SenRozeti />}
              </span>
              <span
                className="rutbe-chip"
                style={{
                  color:
                    k.davet_durumu === "kabul"
                      ? "var(--success)"
                      : k.davet_durumu === "red"
                        ? "var(--danger)"
                        : "var(--text-dim)",
                }}
              >
                {k.davet_durumu === "kabul" ? "Hazır" : k.davet_durumu === "red" ? "Reddetti" : "Bekliyor…"}
              </span>
            </div>
          ))}
        </div>
        {benimKayit?.davet_durumu === "bekliyor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "20px auto 0" }}>
            <button className="btn" onClick={() => cevapVer(true)}>
              Kabul Et
            </button>
            <button className="btn tehlike" onClick={() => cevapVer(false)}>
              Reddet
            </button>
          </div>
        )}
        <button className="btn ikincil" style={{ marginTop: 16, maxWidth: 340 }} onClick={() => navigate(y("/meydan"))}>
          Geri dön
        </button>
      </div>
    );
  }

  if (mac.durum === "iptal") {
    return (
      <div className="buyuk-mesaj">
        <div className="emoji"><Ikon ad="carpi" boyut={40} /></div>
        <h2>Grup maçı iptal edildi</h2>
        <p className="alt-yazi">Davetlilerden biri reddetti.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate(y("/meydan"))}>
          Geri dön
        </button>
      </div>
    );
  }

  if (mac.durum === "bitti" && !gecisBitti) {
    return (
      <SureDolduGecis
        baslik="Maç bitti!"
        skor={benimKayit?.skor ?? 0}
        skorEtiket="puan"
        kazandi={mac.kazanan === user.id}
        kaybetti={mac.kazanan !== null && mac.kazanan !== user.id}
        onBitti={() => setGecisBitti(true)}
      />
    );
  }

  if (mac.durum === "bitti") {
    const kazandim = mac.kazanan === user.id;
    const berabere = mac.kazanan === null;
    return (
      <div className="buyuk-mesaj">
        <div className="emoji"><Ikon ad={berabere ? "kisiler" : kazandim ? "kupa" : "kalkan"} boyut={40} /></div>
        <h2>
          {berabere ? "Berabere!" : kazandim ? `Kazandın! +${10 * mac.oyuncu_sayisi} puan` : "Kaybettin"}
        </h2>
        <div className="kart" style={{ maxWidth: 340, margin: "20px auto 0" }}>
          {siraliSkor.map((k, i) => (
            <div key={k.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span className={`sira-no ${i < 1 ? "ilk3" : ""}`}>{i + 1}</span>
              <Avatar profile={k.profil} boyut={34} />
              <span style={{ flex: 1, fontWeight: 600, textAlign: "left" }}>
                {k.profil?.gorunen_ad}{k.user_id === user.id && <SenRozeti />}
              </span>
              <span style={{ fontWeight: 800 }}>{k.skor}</span>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 340, margin: "12px auto 0" }}>
          <YanlisSatiri macTur="grup" macId={id} />
        </div>
        <button className="btn ikincil" style={{ marginTop: 16, maxWidth: 340, margin: "16px auto 0" }} onClick={() => navigate(y("/meydan"))}>
          Meydan okumalara dön
        </button>
      </div>
    );
  }

  // Aktif maç
  return (
    <div>
      <div className="grup-skor-listesi">
        <div className="alt-yazi" style={{ textAlign: "center", marginBottom: 8 }}>
          Soru {mac.aktif_soru + 1}/{mac.soru_ids?.length ?? 20}
        </div>
        {siraliSkor.map((k) => (
          <div
            key={k.user_id}
            className={`grup-skor-satir ${k.user_id === user.id ? "sen" : ""}`}
          >
            <Avatar profile={k.profil} boyut={30} />
            <span className="isim">{k.profil?.gorunen_ad}{k.user_id === user.id && <SenRozeti />}</span>
            {balonlar[k.user_id] && (
              <span className={`balon grup ${k.user_id === user.id ? "" : "rakip"}`}>
                {balonIcerik(balonlar[k.user_id])}
              </span>
            )}
            <span className="skor">{k.skor}</span>
          </div>
        ))}
      </div>

      <div className="sohbet-bar">
        {TEPKILER.map((t) => (
          <button
            key={t.deger}
            onClick={() => mesajGonder(t.deger)}
            aria-label={t.etiket}
            title={t.etiket}
          >
            <Ikon ad={t.ad} boyut={18} />
          </button>
        ))}
        <button
          className={kaliplarAcik ? "acik" : ""}
          onClick={() => setKaliplarAcik((a) => !a)}
        >
          <Ikon ad="sohbet" boyut={18} />
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
          macTur={"grup"}
          macId={id}
          kategori={mac.kategori}
        />
      )}

      {cevapladim && (
        <div className="alt-yazi" style={{ textAlign: "center", marginTop: 14 }}>
          Diğer oyuncuların cevaplaması bekleniyor…
        </div>
      )}
    </div>
  );
}
