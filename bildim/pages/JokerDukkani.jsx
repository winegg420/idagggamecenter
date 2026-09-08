import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { JOKER_BILGI, envanterNesne } from "../lib/jokerler.js";
import { h5AdsYapilandirildi, odulluVideoGoster } from "../lib/h5ads.js";
import { desteklenirMi, fiyatlariAl, satinAl, tuket } from "../lib/playFatura.js";

export default function JokerDukkani() {
  const [envanter, setEnvanter] = useState({ elli: 0, sure: 0, pas: 0, seri_koruma: 0 });
  const [reklam, setReklam] = useState({ bugun: 0, tavan: 5 });
  const [paketler, setPaketler] = useState([]);
  const [fiyatlar, setFiyatlar] = useState({});
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [videoCalisiyor, setVideoCalisiyor] = useState(false);
  const [alinan, setAlinan] = useState(null);

  const playVar = desteklenirMi();

  const yukle = useCallback(async () => {
    try {
      const [env, rek, pak] = await Promise.all([
        supabase.rpc("envanterim"),
        supabase.rpc("reklam_durumum"),
        supabase.from("joker_paketleri").select("*").order("sira"),
      ]);
      if (env.error) throw env.error;
      setEnvanter(envanterNesne(env.data));
      if (!rek.error) {
        const r = Array.isArray(rek.data) ? rek.data[0] : rek.data;
        if (r) setReklam({ bugun: r.bugun ?? 0, tavan: r.tavan ?? 5 });
      }
      if (!pak.error) setPaketler(pak.data ?? []);
    } catch (e) {
      setHata(e.message ?? "Dükkân yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Play fiyatları yalnız Android uygulamasında okunabilir
  useEffect(() => {
    if (!playVar || paketler.length === 0) return;
    let aktif = true;
    fiyatlariAl(paketler.map((p) => p.urun_id))
      .then((f) => aktif && setFiyatlar(f))
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [playVar, paketler]);

  const videoIzle = async () => {
    setHata(null);
    setBilgi(null);
    setVideoCalisiyor(true);
    try {
      // 1) Reklamı göster — başarısızsa SUNUCUYA HİÇ GİDİLMEZ (sahte ödül yok)
      await odulluVideoGoster();
      // 2) Ödülü sunucu verir
      const ref = `h5-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const { data, error } = await supabase.rpc("reklam_odulu_al", { p_reklam_ref: ref });
      if (error) throw error;
      const s = Array.isArray(data) ? data[0] : data;
      setBilgi(`+1 50:50 jokeri kazandın! (bugün ${s?.bugun ?? "?"}/${s?.tavan ?? 5})`);
      await yukle();
    } catch (e) {
      setHata(e.message ?? "Reklam gösterilemedi.");
    } finally {
      setVideoCalisiyor(false);
    }
  };

  const paketAl = async (urunId) => {
    setHata(null);
    setBilgi(null);
    setAlinan(urunId);
    try {
      const { purchase_token } = await satinAl(urunId);

      // Doğrulama SUNUCUDA (Edge Function → Play Developer API)
      const { data: oturum } = await supabase.auth.getSession();
      const jwt = oturum?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/satin_alma_dogrula`;
      const cevap = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ urun_id: urunId, purchase_token }),
      });
      const sonuc = await cevap.json();
      if (!cevap.ok) throw new Error(sonuc?.hata ?? "Satın alma doğrulanamadı.");

      await tuket(purchase_token);
      setBilgi("Satın alman tamamlandı, jokerler hesabına eklendi 🎉");
      await yukle();
    } catch (e) {
      setHata(e.message ?? "Satın alma tamamlanamadı.");
    } finally {
      setAlinan(null);
    }
  };

  const reklamKaldi = Math.max(0, (reklam.tavan ?? 5) - (reklam.bugun ?? 0));

  return (
    <div className="bd-dukkan">
      <div className="baslik">🎁 Joker Dükkânı</div>

      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      {/* ---------- Envanter ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>🎒 Envanterin</span></div>
        <div className="bd-envanter-grid">
          {Object.entries(JOKER_BILGI).map(([tur, b]) => (
            <div key={tur} className="bd-envanter-kutu">
              <span className="bd-envanter-ikon" aria-hidden="true">{b.ikon}</span>
              <span className="bd-envanter-adet">{envanter[tur] ?? 0}</span>
              <span className="bd-envanter-ad">{b.ad}</span>
            </div>
          ))}
        </div>
        <div className="alt-yazi" style={{ marginTop: 10 }}>
          Her maçta <b>1 adet 50:50 ücretsizdir</b> (kullanılmazsa birikmez).
          Lig maçlarında maç başına en fazla 2 joker, arkadaş maçlarında sınırsız.
          Turnuva finalinde joker kullanılamaz.
        </div>
      </div>

      {/* ---------- Ödüllü video ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>🎬 Video izle, joker kazan</span>
          <span className="alt-yazi">bugün {reklam.bugun}/{reklam.tavan}</span>
        </div>
        <div className="alt-yazi" style={{ marginBottom: 12 }}>
          Bir video = <b>+1 adet 50:50</b>. Günde en fazla {reklam.tavan} ödül.
        </div>

        {!h5AdsYapilandirildi() ? (
          <>
            <button className="btn ikincil" disabled>
              Reklam şu an kullanılamıyor
            </button>
            <div className="alt-yazi" style={{ marginTop: 8 }}>
              Reklam kimliği tanımlı değil (test modu). Sahte ödül verilmez.
            </div>
          </>
        ) : (
          <button
            className="btn"
            disabled={videoCalisiyor || reklamKaldi <= 0}
            onClick={videoIzle}
          >
            {videoCalisiyor
              ? "Reklam açılıyor…"
              : reklamKaldi <= 0
                ? "Bugünlük hakkın doldu"
                : `▶️ Video izle (+1 joker)`}
          </button>
        )}
      </div>

      {/* ---------- Paketler ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>🛒 Joker paketleri</span></div>

        {!playVar && (
          <div className="bd-uyari">
            Satın alma yalnızca <b>Android uygulamasında</b> yapılabilir.
            Tarayıcıda paket satın alınamaz.
          </div>
        )}

        <div className="bd-paket-liste">
          {paketler.map((p) => {
            const f = fiyatlar[p.urun_id];
            return (
              <div key={p.urun_id} className="bd-paket">
                <div className="bd-paket-bilgi">
                  <div className="bd-paket-ad">{f?.ad ?? p.ad}</div>
                  <div className="alt-yazi">{f?.aciklama ?? p.aciklama}</div>
                  <div className="bd-paket-icerik">
                    {Object.entries(p.icerik ?? {}).map(([tur, adet]) => (
                      <span key={tur} className="bd-paket-parca">
                        {JOKER_BILGI[tur]?.ikon ?? "❔"} {adet}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="btn kucuk"
                  disabled={!playVar || alinan === p.urun_id}
                  onClick={() => paketAl(p.urun_id)}
                >
                  {alinan === p.urun_id ? "…" : (f?.fiyat ?? (playVar ? "Satın al" : "Uygulamada"))}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Yasal ---------- */}
      <div className="kart bd-gizlilik-not">
        Satın alımlar Google Play üzerinden işlenir; ödeme bilgilerin Bildim! ile
        paylaşılmaz. Tüketilebilir ürünlerde iade Google Play kurallarına tabidir.
        Ayrıntı için <Link to="/gizlilik">Gizlilik Politikası</Link>.
      </div>
    </div>
  );
}
