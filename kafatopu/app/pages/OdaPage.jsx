// ============================================================
// KAFA TOPU — özel oda lobisi.
// Kodla/davetle gelinir; kadro iki takım halinde görünür, arkadaş davet
// edilir, oda dolunca kurucu maçı başlatır. Durum 2.5 sn'de bir poll edilir;
// "basladi" görülünce herkes maça geçer.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import KafaOnizleme from "../components/KafaOnizleme.jsx";

const POLL_MS = 2500;

export default function OdaPage() {
  const { kod } = useParams();
  const { user } = useKT();
  const navigate = useNavigate();

  const [oda, setOda] = useState(null);
  const [oyuncular, setOyuncular] = useState([]);
  const [arkadaslar, setArkadaslar] = useState([]);
  const [gonderilen, setGonderilen] = useState({});
  const [hata, setHata] = useState("");
  const [kopyalandi, setKopyalandi] = useState(false);
  const macaGitti = useRef(false);
  const katildi = useRef(false);

  // ---------- Oda + kadro yükleme ----------
  const yukle = useCallback(async () => {
    try {
      const { data: odalar, error } = await supabase
        .from("kafatopu_odalar")
        .select("*")
        .eq("kod", kod.toUpperCase())
        .in("durum", ["bekliyor", "basladi"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const o = odalar?.[0];
      if (!o) {
        setHata("Oda bulunamadı ya da kapanmış.");
        return;
      }
      setOda(o);

      if (o.durum === "basladi" && o.mac_id) {
        macaGitti.current = true;
        navigate(`/kafatopu/mac/${o.mac_id}`, { replace: true });
        return;
      }

      const { data: uyeler } = await supabase
        .from("kafatopu_oda_oyunculari")
        .select("*")
        .eq("oda_id", o.id)
        .order("slot");

      // Üye değilsem (linkle geldim) otomatik katılmayı dene — bir kez.
      if (!katildi.current && !(uyeler ?? []).some((u) => u.user_id === user.id)) {
        katildi.current = true;
        const { error: e2 } = await supabase.rpc("kafatopu_odaya_katil", { p_kod: kod });
        if (e2) {
          setHata("Odaya katılınamadı (dolu olabilir).");
          return;
        }
        return yukle();
      }
      katildi.current = true;

      // Adlar + kafalar
      const idler = (uyeler ?? []).map((u) => u.user_id);
      let profiller = {};
      if (idler.length) {
        const [{ data: adlar }, { data: ktp }] = await Promise.all([
          supabase.from("profiles").select("id, username").in("id", idler),
          supabase.from("kafatopu_profiller").select("user_id, kafa").in("user_id", idler),
        ]);
        for (const p of adlar ?? []) profiller[p.id] = { ad: p.username };
        for (const p of ktp ?? []) profiller[p.user_id] = { ...profiller[p.user_id], kafa: p.kafa };
      }
      setOyuncular(
        (uyeler ?? []).map((u) => ({
          ...u,
          ad: profiller[u.user_id]?.ad ?? "Oyuncu",
          kafa: profiller[u.user_id]?.kafa ?? "volkan",
        }))
      );
    } catch (e) {
      console.error("KafaTopu oda yükleme hatası:", e);
      setHata("Oda yüklenemedi.");
    }
  }, [kod, user.id, navigate]);

  useEffect(() => {
    yukle();
    const poll = setInterval(yukle, POLL_MS);
    return () => clearInterval(poll);
  }, [yukle]);

  // ---------- Arkadaş listesi (Bildim dostlukları) ----------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("friendships")
          .select(`requester, addressee, durum,
            req:profiles!friendships_requester_fkey(id, username),
            add:profiles!friendships_addressee_fkey(id, username)`)
          .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
          .eq("durum", "arkadas");
        setArkadaslar(
          (data ?? []).map((f) => (f.requester === user.id ? f.add : f.req)).filter(Boolean)
        );
      } catch (e) {
        console.error("KafaTopu arkadaş listesi hatası:", e);
      }
    })();
  }, [user.id]);

  const davetEt = async (arkadas) => {
    if (!oda) return;
    try {
      const { error } = await supabase.rpc("kafatopu_davet_gonder", {
        p_oda: oda.id,
        p_alici: arkadas.id,
      });
      if (error) throw error;
      setGonderilen((g) => ({ ...g, [arkadas.id]: true }));
    } catch (e) {
      console.error("KafaTopu davet gönderme hatası:", e);
    }
  };

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(
        `Kafa Topu odama katıl! Kod: ${oda.kod} — ${location.origin}/kafatopu/oda/${oda.kod}`
      );
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    } catch (e) {
      console.error("KafaTopu kopyalama hatası:", e);
    }
  };

  const baslat = async () => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_oda_baslat", { p_oda: oda.id });
      if (error) throw error;
      macaGitti.current = true;
      navigate(`/kafatopu/mac/${data}`, { replace: true });
    } catch (e) {
      console.error("KafaTopu oda başlatma hatası:", e);
      setHata("Başlatılamadı — oda dolu mu?");
      setTimeout(() => setHata(""), 2500);
    }
  };

  const ayril = async () => {
    try {
      await supabase.rpc("kafatopu_odadan_ayril");
    } catch (e) {
      console.error("KafaTopu odadan ayrılma hatası:", e);
    }
    navigate("/kafatopu");
  };

  if (hata && !oda) {
    return (
      <div className="kt-sayfa kt-kuyruk-orta">
        <h1 className="kt-baslik">🏟 Oda</h1>
        <div className="kt-alt-yazi">{hata}</div>
        <button className="kt-btn ikincil" style={{ maxWidth: 340, margin: "16px auto" }} onClick={() => navigate("/kafatopu")}>
          <span className="kt-btn-ikon">←</span><span>Menüye dön</span>
        </button>
      </div>
    );
  }
  if (!oda) return <div className="kt-sayfa kt-kuyruk-orta"><div className="kt-spinner" /></div>;

  const kapasite = oda.mod === "1v1" ? 2 : 4;
  const kurucuMuyum = oda.kurucu === user.id;
  const dolu = oyuncular.length >= kapasite;
  const takim1 = oyuncular.filter((o) => o.takim === 1);
  const takim2 = oyuncular.filter((o) => o.takim === 2);
  const bosSayi1 = (kapasite === 2 ? 1 : 2) - takim1.length;
  const bosSayi2 = (kapasite === 2 ? 1 : 2) - takim2.length;

  return (
    <div className="kt-sayfa">
      <h1 className="kt-baslik">🏟 Özel Oda · {oda.mod}</h1>

      {/* Oda kodu */}
      <div className="kt-oda-kod" onClick={kopyala} title="Kopyala">
        <span className="kt-oda-kod-yazi">{oda.kod}</span>
        <span className="kt-oda-kod-ipucu">{kopyalandi ? "Kopyalandı ✓" : "📋 Kodu + linki kopyala"}</span>
      </div>

      {/* Kadro: iki takım karşı karşıya */}
      <div className="kt-oda-kadro">
        <div className="kt-oda-takim">
          <div className="kt-oda-takim-ad" style={{ color: "#ff6b5e" }}>🔴 Kırmızı</div>
          {takim1.map((o) => (
            <OyuncuKarti key={o.user_id} o={o} benim={o.user_id === user.id} kurucu={o.user_id === oda.kurucu} takim={1} />
          ))}
          {Array.from({ length: bosSayi1 }).map((_, i) => <BosSlot key={i} />)}
        </div>
        <div className="kt-oda-vs">VS</div>
        <div className="kt-oda-takim">
          <div className="kt-oda-takim-ad" style={{ color: "#6ba3ff" }}>🔵 Mavi</div>
          {takim2.map((o) => (
            <OyuncuKarti key={o.user_id} o={o} benim={o.user_id === user.id} kurucu={o.user_id === oda.kurucu} takim={2} />
          ))}
          {Array.from({ length: bosSayi2 }).map((_, i) => <BosSlot key={i} />)}
        </div>
      </div>

      {hata && <div className="kt-alt-yazi" style={{ color: "#ffb3a8" }}>{hata}</div>}

      {/* Başlat / bekleme */}
      {kurucuMuyum ? (
        <button className="kt-arcade-btn oyna" style={{ width: "100%" }} onClick={baslat} disabled={!dolu}>
          {dolu ? "▶ MAÇI BAŞLAT" : `Oyuncu bekleniyor (${oyuncular.length}/${kapasite})`}
        </button>
      ) : (
        <div className="kt-kart" style={{ textAlign: "center" }}>
          {dolu ? "Kurucunun başlatması bekleniyor…" : `Oyuncu bekleniyor (${oyuncular.length}/${kapasite})`}
        </div>
      )}

      {/* Arkadaş daveti */}
      <div className="kt-kart" style={{ marginTop: 12 }}>
        <b>🎟 Arkadaş davet et</b>
        {arkadaslar.length === 0 && (
          <div className="kt-alt-yazi" style={{ marginTop: 6 }}>
            Bildim arkadaş listen boş — kodu ya da linki paylaşarak da çağırabilirsin.
          </div>
        )}
        {arkadaslar.map((a) => {
          const zatenIcerde = oyuncular.some((o) => o.user_id === a.id);
          return (
            <div key={a.id} className="kt-sira-satir">
              <span className="kt-sira-ad">{a.username}</span>
              {zatenIcerde ? (
                <span className="kt-istatistik">Odada ✓</span>
              ) : gonderilen[a.id] ? (
                <span className="kt-istatistik">Davet gitti ✓</span>
              ) : (
                <button className="kt-mini-btn kabul" onClick={() => davetEt(a)}>Davet Et</button>
              )}
            </div>
          );
        })}
      </div>

      <button className="kt-btn tehlike" onClick={ayril}>
        <span className="kt-btn-ikon">🚪</span>
        <span>Odadan Ayrıl{kurucuMuyum ? " (oda kapanır)" : ""}</span>
      </button>
    </div>
  );
}

function OyuncuKarti({ o, benim, kurucu, takim }) {
  return (
    <div className={`kt-oda-oyuncu ${benim ? "ben" : ""}`}>
      <KafaOnizleme kafaId={o.kafa} takim={takim} genislik={72} yukseklik={94} />
      <div className="kt-oda-oyuncu-ad">
        {kurucu && "👑 "}{o.ad}{benim && " (sen)"}
      </div>
    </div>
  );
}

function BosSlot() {
  return (
    <div className="kt-oda-oyuncu bos">
      <div className="kt-oda-bos-ikon">➕</div>
      <div className="kt-oda-oyuncu-ad">Boş</div>
    </div>
  );
}
