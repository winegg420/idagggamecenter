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
import { useGorunurlukTazele, zamanAsimiyla } from "../lib/gorunurluk.js";

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
  // Süre doldu ama ilerletme henüz başarılı olmadı mı? Dönüşte hemen denenir.
  const bekleyenIlerletme = useRef(false);
  const pollRef = useRef(null);
  const kanalRef = useRef(null);
  // Kanal düştüğünde yeniden kurma zamanlayıcısı ve güncel kanalKur referansı
  const yenidenBaglaRef = useRef(null);
  const kanalKurRef = useRef(null);
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

  // Kanal kurulumu ayrı fonksiyonda: sekmeden dönüşte ölmüş soket yeniden kurulur.
  const kanalKur = useCallback(() => {
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
      // Kanal ölürse sessizce kalmasın: Realtime kopmasi (ag dalgalanmasi,
      // uyku, arka plan) CHANNEL_ERROR/TIMED_OUT/CLOSED olarak bildirilir.
      // Yoklama zaten veriyi getiriyor ama kanal geri kurulmazsa anlık
      // güncellemeler (rakip skoru, mesaj) bir daha hiç gelmiyordu.
      .subscribe((durum) => {
        if (durum === "CHANNEL_ERROR" || durum === "TIMED_OUT" || durum === "CLOSED") {
          console.warn("[Bildim] hizli mac kanali dustu:", durum);
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
  }, [id, macYukle]);

  // Kanal izleyicisi kanalKur'u çağırabilsin (kanalKur kendi tanımına
  // referans veremediği için güncel hâli her render'da ref'e yazılır).
  kanalKurRef.current = kanalKur;

  useEffect(() => {
    macYukle();
    kanalKur();
    return () => {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalRef.current = null;
      if (yenidenBaglaRef.current) clearTimeout(yenidenBaglaRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, macYukle, kanalKur]);

  // Sekmeden dönünce: sunucudaki güncel durumu çek + Realtime kanalını yenile.
  // Ortak soru saati olduğu için istemci ekstra atlama tetiklemez.
  useGorunurlukTazele(() => {
    macYukle();
    // Arka planda setTimeout donduğu için bekleyen ilerletme burada çalışır.
    if (bekleyenIlerletme.current) ilerletmeyiDene();
    try {
      if (kanalRef.current) supabase.removeChannel(kanalRef.current);
      kanalKur();
    } catch (e) {
      console.error("[Bildim] realtime yeniden kurulamadi:", e);
    }
  }, mac?.durum === "aktif");

  // Soru değişince çek
  useEffect(() => {
    if (!mac || mac.durum !== "aktif" || mac.aktif_soru < 0) {
      setSoru(null);
      return;
    }
    advanceKilidi.current = false;
    bekleyenIlerletme.current = false;
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

  // İlerletme: hata yutulmaz, kilit başarısızlıkta AÇILIR.
  // Eskiden .catch() bile yoktu; sekme arka plandayken RPC düşünce ilerleme
  // hiç olmuyor, advanceKilidi kapalı kaldığı için de bir daha denenmiyordu —
  // oyuncu döndüğünde ekran donuk kalıyordu.
  const ilerletmeyiDene = useCallback(async () => {
    try {
      const { error } = await zamanAsimiyla(
        supabase.rpc("advance_hizli_mac", { p_hizli_mac_id: id }),
        10000,
        "advance_hizli_mac"
      );
      if (error) throw error;
      bekleyenIlerletme.current = false;
      await macYukle();
    } catch (e) {
      console.error("[Bildim] ilerletme basarisiz, yeniden denenecek:", e);
      advanceKilidi.current = false; // yeniden denenebilsin
      macYukle();
    }
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

  // Süre dolunca ilerletme "bekleyen iş" olarak işaretlenir. Gecikme, aynı anda
  // yüzlerce istemcinin sunucuya yüklenmemesi için (mevcut davranış). Ama
  // setTimeout arka planda donduğundan, sekmeden dönüşte bekleyen iş varsa
  // gecikmeyi beklemeden çalıştırılır (bkz. useGorunurlukTazele).
  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current) return;
    advanceKilidi.current = true;
    bekleyenIlerletme.current = true;
    setTimeout(() => {
      if (bekleyenIlerletme.current) ilerletmeyiDene();
    }, Math.random() * 800 + 1000);
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
