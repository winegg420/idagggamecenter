import { useCallback, useEffect, useRef, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import SenRozeti from "../components/SenRozeti.jsx";
import YanlisSatiri from "../components/YanlisSatiri.jsx";
import SureDolduGecis from "../components/SureDolduGecis.jsx";
import { useOyunModu } from "../lib/oyunModu.js";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import MacYukleniyor from "../components/MacYukleniyor.jsx";
import { hataMesaji } from "../lib/hata.js";
import { y } from "../lib/yol.js";

const HIZLI_SECIMI = `*,
  katilimcilar:hizli_oyuncular(hizli_mac_id, user_id, davet_durumu, skor, joined_at,
    profil:profiles(id, gorunen_ad, gorunen_avatar))`;

export default function HizliMacPage() {
  const { id } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mac, setMac] = useState(null);
  const [soru, setSoru] = useState(null);
  const [cevapladim, setCevapladim] = useState(false);
  const [ilkBildim, setIlkBildim] = useState(null); // true=ilk, false=geç kaldı
  const [yuklemeHatasi, setYuklemeHatasi] = useState(null);
  const advanceKilidi = useRef(false);
  const pollRef = useRef(null);
  // Maç bitişinde sonuç ekranından önce 0.8 sn'lik "Maç bitti!" perdesi
  const [gecisBitti, setGecisBitti] = useState(false);

  const macYukle = useCallback(async () => {
    // Hata YUTULMAZ: sessiz kilitlenmenin sebebi buydu.
    try {
      const { data, error } = await supabase
        .from("hizli_maclar")
        .select(HIZLI_SECIMI)
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data) {
        setMac(data);
        setYuklemeHatasi(null);
      }
      return data;
    } catch (e) {
      console.error("[Bildim] hizli mac yuklenemedi:", e);
      setYuklemeHatasi(hataMesaji(e, "Maç bilgisi alınamadı."));
      return null;
    }
  }, [id]);

  const maciIptalEt = useCallback(async () => {
    try {
      await supabase.rpc("hizli_mac_iptal", { p_hizli_mac_id: id });
    } catch (e) {
      console.error("[Bildim] hizli mac iptal:", e);
    }
    navigate(y("/meydan"));
  }, [id, navigate]);

  useEffect(() => {
    macYukle();
    const kanal = supabase
      .channel(`hizli-mac-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "hizli_maclar", filter: `id=eq.${id}` },
        () => macYukle()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hizli_oyuncular", filter: `hizli_mac_id=eq.${id}` },
        () => macYukle()
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
    setIlkBildim(null);
    if (pollRef.current) clearInterval(pollRef.current);
    supabase
      .rpc("get_hizli_soru", { p_hizli_mac_id: mac.id })
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
    supabase.rpc("advance_hizli_mac", { p_hizli_mac_id: id }).then(() => macYukle());
  }, [id, macYukle]);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_hizli_cevap", {
      p_hizli_mac_id: id,
      p_cevap: i,
    });
    if (error) throw error;
    setCevapladim(true);
    const sonuc = data?.[0];
    if (sonuc) setIlkBildim(sonuc.dogru ? sonuc.ilk : null);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(ilerletmeyiDene, 2500);
    return sonuc;
  };

  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current) return;
    advanceKilidi.current = true;
    setTimeout(ilerletmeyiDene, Math.random() * 800 + 1000);
  }, [ilerletmeyiDene]);

  const cevapVer = async (kabul) => {
    const { error } = await supabase.rpc("respond_hizli_davet", {
      p_hizli_mac_id: id,
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
        <div className="emoji"><Ikon ad="hizli" boyut={40} /></div>
        <h2>Hızlı yarış bekleniyor</h2>
        <p className="alt-yazi" style={{ marginBottom: 16 }}>
          {bekleyenler.length > 0
            ? `${bekleyenler.map((b) => b.profil?.gorunen_ad).join(", ")} henüz kabul etmedi.`
            : "Herkes hazır olunca yarış otomatik başlayacak."}
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
        <h2>Hızlı yarış iptal edildi</h2>
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
          {berabere ? "Berabere!" : kazandim ? "Kazandın! +50 puan" : "Kaybettin"}
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
          <YanlisSatiri macTur="hizli" macId={id} />
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
      <div className="durum-bandi canli" style={{ marginBottom: 12 }}>
        Hızlı Olan Kazanır · İlk doğru cevap +10
      </div>

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
            <span className="skor">{k.skor}</span>
          </div>
        ))}
      </div>

      {soru && (
        <QuestionCard
          key={`${mac.id}-${mac.aktif_soru}`}
          soru={soru}
          onCevapla={cevapla}
          onSureDoldu={sureDoldu}
          macTur="hizli"
          macId={mac.id}
          // "Hızlı Olan Kazanır"da soru başına puan yok — uçan rozet çizilmez
          puanHesapla={null}
        />
      )}

      {cevapladim && (
        <div className="alt-yazi" style={{ textAlign: "center", marginTop: 14 }}>
          {ilkBildim === true
            ? "İlk sen bildin! +10 puan"
            : ilkBildim === false
              ? "Birisi senden hızlı davrandı"
              : "Diğer oyuncular bekleniyor…"}
        </div>
      )}
    </div>
  );
}
