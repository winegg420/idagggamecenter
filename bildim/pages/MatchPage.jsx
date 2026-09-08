import { useCallback, useEffect, useRef, useState } from "react";
import { hataMesaji } from "../lib/hata.js";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import BildirimIzniSor from "../components/BildirimIzniSor.jsx";
import MacSonuEklentisi from "../components/MacSonuEklentisi.jsx";
import Maskot from "../components/Maskot.jsx";
import Ikon from "../components/Ikon.jsx";
import MacYukleniyor from "../components/MacYukleniyor.jsx";
import { useOyunModu } from "../lib/oyunModu.js";
import { macBittiReklam } from "../lib/reklam.js";

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
  const [ilerleme, setIlerleme] = useState({ ben: 0, rakip: 0 });
  const [bilgiKapandi, setBilgiKapandi] = useState(false);
  // Bilgi kartı yalnız maça ilk girişte gösterilir. Sonradan belirip soru
  // ekranını aşağı itmesin diye ilk render'da sabitlenir (canlı testte
  // düzen kayması yüzünden şıkka tıklanamıyordu).
  const ilkGirisRef = useRef(null);
  const [yuklemeHatasi, setYuklemeHatasi] = useState(null);
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
      setJokerHata(hataMesaji(error));
      return null;
    }
    setJokerKullanildi((k) => ({ ...k, [tip]: true }));
    refreshProfile(user.id);
    return data;
  };

  const macYukle = useCallback(async () => {
    let data = null;
    try {
      const sonuc = await supabase
        .from("matches")
        .select(MAC_SECIMI)
        .eq("id", id)
        .single();
      if (sonuc.error) throw sonuc.error;
      data = sonuc.data;
      if (data) setYuklemeHatasi(null);
    } catch (e) {
      console.error("[Bildim] mac yuklenemedi:", e);
      setYuklemeHatasi(hataMesaji(e, "Maç bilgisi alınamadı."));
    }
    if (data) setMac(data);

    // Asenkron maçta iki taraf farklı soruda olabilir.
    // match_answers RLS'i yalnız KENDİ cevaplarını gösterdiği için rakip
    // ilerlemesi hep 0 çıkıyordu; sayaçlar matches tablosunda tutuluyor.
    if (data) {
      const benP1x = data.oyuncu1 === user.id;
      setIlerleme({
        ben: benP1x ? (data.oyuncu1_soru ?? 0) : (data.oyuncu2_soru ?? 0),
        rakip: benP1x ? (data.oyuncu2_soru ?? 0) : (data.oyuncu1_soru ?? 0),
      });
    }
    return data;
  }, [id, user.id]);

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

  // Soru değişince çek — ASENKRON: kendi sıra indeksimize bağlı
  const kendiIndeks =
    mac && mac.oyuncu1 === user.id ? (mac.oyuncu1_soru ?? 0) : (mac?.oyuncu2_soru ?? 0);
  useEffect(() => {
    if (!mac || mac.durum !== "aktif") {
      setSoru(null);
      return;
    }
    // Kendi bölümümüz bittiyse soru çekme (sunucu da hata döndürür)
    if (kendiIndeks >= (mac.soru_ids?.length ?? 0)) {
      setSoru(null);
      return;
    }
    advanceKilidi.current = false;
    setCevapladim(false);
    supabase
      .rpc("get_match_question", { p_match_id: mac.id })
      .then(({ data, error }) => {
        if (error) {
          console.error("[Bildim] soru alinamadi:", error);
          return;
        }
        if (data?.[0]) setSoru(data[0]);
      });
  }, [mac?.id, mac?.durum, kendiIndeks, mac?.soru_ids?.length]);

  useOyunModu(Boolean(soru) && mac?.durum === "aktif");

  // Maç bitince puan tazele + (sıklık kuralı uygunsa) geçiş reklamı
  const reklamGosterildiRef = useRef(false);
  useEffect(() => {
    if (mac?.durum === "bitti") {
      refreshProfile(user.id);
      if (pollRef.current) clearInterval(pollRef.current);
      if (!reklamGosterildiRef.current) {
        reklamGosterildiRef.current = true;
        macBittiReklam().catch(() => {}); // reklam akışı oyunu asla bloklamaz
      }
    }
  }, [mac?.durum, refreshProfile, user.id]);

  // Asenkron akışta ortak ilerletme yok; advance_match yalnız BİTİŞ kontrolü
  // yapıyor. Rakip kendi bölümünü bitirmiş olabilir diye ara ara yoklanır.
  const ilerletmeyiDene = useCallback(() => {
    supabase
      .rpc("advance_match", { p_match_id: id })
      .then(() => macYukle())
      .catch(() => {});
  }, [id, macYukle]);

  const cevapla = async (i) => {
    const { data, error } = await supabase.rpc("submit_match_answer", {
      p_match_id: id,
      p_cevap: i,
    });
    if (error) throw error;
    setCevapladim(true);
    // Kendi sıramız sunucuda ilerledi; bir sonraki soruyu çekmek için tazele.
    setTimeout(macYukle, 900);
    return data?.[0];
  };

  // Asenkron maç: süre dolunca YALNIZ kendi sıramız atlanır, rakip beklenmez.
  const sureDoldu = useCallback(() => {
    if (advanceKilidi.current) return;
    advanceKilidi.current = true;
    supabase
      .rpc("mac_soruyu_atla", { p_match_id: id })
      .then(() => macYukle())
      .catch((e) => console.error("[Bildim] soru atlanamadi:", e));
  }, [id, macYukle]);

  if (!mac) {
    return (
      <MacYukleniyor
        hata={yuklemeHatasi}
        onTekrarDene={() => { setYuklemeHatasi(null); macYukle(); }}
      />
    );
  }

  const benP1 = mac.oyuncu1 === user.id;
  const toplamSoru = mac.soru_ids?.length ?? 5;
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
        <Maskot
          poz={kazandim ? "kutluyor" : berabere ? "selam" : "dusunuyor"}
          boyut={110}
          className="bd-sonuc-maskot"
        />
        <h2 className={`bd-sonuc-baslik ${kazandim ? "kazandi" : berabere ? "" : "kaybetti"}`}>
          {berabere ? "Berabere!" : kazandim ? "Kazandın!" : "Kaybettin"}
        </h2>
        {kazandim && <span className="bd-sonuc-kazanc">+20 ⭐</span>}
        <div className="skor-tabela" style={{ marginTop: 20 }}>
          <div className="taraf">
            <div className="isim">{benimProfil?.gorunen_ad} (sen)</div>
            <div className="skor">{benimSkor}</div>
            <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
          </div>
          <div className="vs">VS</div>
          <div className="taraf">
            <div className="isim">{rakipProfil?.gorunen_ad}</div>
            <div className="skor">{rakipSkor}</div>
            <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
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

  // Asenkron maç: kendi bölümümüz bitti ama rakip henüz oynamadı.
  // Maç burada kapanmaz — rakip kendi zamanında oynayınca sonuçlanır.
  const benimSoru = benP1 ? (mac.oyuncu1_soru ?? 0) : (mac.oyuncu2_soru ?? 0);
  if (mac.durum === "aktif" && benimSoru >= toplamSoru) {
    return (
      <div className="buyuk-mesaj">
        <Maskot poz="selam" boyut={104} className="bd-sonuc-maskot" />
        <h2>Senin bölümün bitti 🎉</h2>
        <p className="alt-yazi" style={{ marginBottom: 14 }}>
          {toplamSoru} sorunun tamamını oynadın. <b>{rakipProfil?.gorunen_ad}</b> kendi
          zamanında oynayınca maç sonuçlanacak — bittiğinde sana haber vereceğiz.
        </p>
        <div className="skor-tabela bd-vs" style={{ maxWidth: 360, margin: "0 auto 16px" }}>
          <div className="taraf bd-vs-taraf">
            <div className="isim">{benimProfil?.gorunen_ad} (sen)</div>
            <div className="skor">{benimSkor}</div>
            <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
          </div>
          <div className="vs bd-vs-rozet">VS</div>
          <div className="taraf bd-vs-taraf">
            <div className="isim">{rakipProfil?.gorunen_ad}</div>
            <div className="skor">{rakipSkor}</div>
            <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
          </div>
        </div>
        <button className="btn" onClick={() => navigate("/bildim/meydan")}>
          Yeni maça başla
        </button>
      </div>
    );
  }

  // Aktif maç
  // İlk render'da bir kez karar ver: rakip öndeyse bilgi kartını göster.
  if (ilkGirisRef.current === null) {
    ilkGirisRef.current = ilerleme.rakip > ilerleme.ben && benimSoru === 0;
  }
  const rakipOnde = ilkGirisRef.current;

  return (
    <div>
      {/* Maç ekranında alt menü gizli; çıkış sol üstte */}
      <button
        className="bd-mac-cikis"
        aria-label="Maçtan çık"
        onClick={() => navigate("/bildim/meydan")}
      >
        <Ikon ad="carpi" boyut={18} />
      </button>

      {rakipOnde && !bilgiKapandi && (
        <div className="bd-mac-bilgi">
          <span className="ikon" aria-hidden="true">
            <Ikon ad="saat" boyut={18} />
          </span>
          <span style={{ flex: 1 }}>
            <b>{rakipProfil?.gorunen_ad}</b> senden önde. Bu maç sıra
            beklemeden oynanır — sen kendi hızında devam et, rakibin de kendi
            zamanında oynar.
          </span>
          <button
            className="btn kucuk ikincil"
            aria-label="Kapat"
            onClick={() => setBilgiKapandi(true)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="skor-tabela bd-vs">
        <div className="taraf bd-vs-taraf">
          <Avatar profile={benimProfil} boyut={44} />
          <div className="isim">{benimProfil?.gorunen_ad} (sen)</div>
          <div className="skor">{benimSkor}</div>
          <div className="bd-vs-ilerleme">{ilerleme.ben}/{toplamSoru}</div>
        </div>
        {/* Asenkron: rozet KENDİ sıramızı gösterir, ortak sayacı değil */}
        <div className="vs bd-vs-rozet">
          {Math.min(benimSoru + 1, toplamSoru)}/{toplamSoru}
        </div>
        <div className="taraf bd-vs-taraf">
          <Avatar profile={rakipProfil} boyut={44} />
          <div className="isim">{rakipProfil?.gorunen_ad}</div>
          <div className="skor">{rakipSkor}</div>
          <div className="bd-vs-ilerleme">{ilerleme.rakip}/{toplamSoru}</div>
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
          Sıradaki soru geliyor…
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

    </div>
  );
}
