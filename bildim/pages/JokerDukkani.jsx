import { useCallback, useEffect, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { JOKER_BILGI, envanterNesne } from "../lib/jokerler.js";
import { h5AdsYapilandirildi, odulluVideoGoster } from "../lib/h5ads.js";
import { desteklenirMi, fiyatlariAl, satinAl, tuket } from "../lib/playFatura.js";
import { useCoin, coinTazele, coinHatasi } from "../lib/coin.js";
import CoinGorseli, { coinBoyutu } from "../components/CoinGorseli.jsx";
import { y } from "../lib/yol.js";

// Dükkân üç sekme: Kıyafet (avatar eşyaları) / Joker / Coin.
// Kıyafet sekmesinin içeriği Görünüm sayfasında; buradan oraya köprü var.
// Reklam ödülü sunucudaki oyun_ayarlari tablosundan gelir; buradaki sayı
// yalnız metinde gösterilen varsayılandır (RPC gerçek değeri döndürür).
const ODUL_COIN = 25;

const SEKMELER = [
  { kod: "kiyafet", ad: "Kıyafet", ikon: "tisort" },
  { kod: "joker",   ad: "Joker",   ikon: "hediye" },
  { kod: "coin",    ad: "Coin",    ikon: "coin" },
];

export default function JokerDukkani() {
  const [envanter, setEnvanter] = useState({ elli: 0, sure: 0, pas: 0, seri_koruma: 0 });
  const [reklam, setReklam] = useState({ bugun: 0, tavan: 5 });
  const [paketler, setPaketler] = useState([]);
  const [fiyatlar, setFiyatlar] = useState({});
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [videoCalisiyor, setVideoCalisiyor] = useState(false);
  const [alinan, setAlinan] = useState(null);
  const [coinPaketleri, setCoinPaketleri] = useState([]);

  // Sekme adres çubuğunda tutulur: "coin yetmiyor" uyarısı doğrudan Coin
  // sekmesine götürebilsin, geri tuşu da beklendiği gibi çalışsın.
  const [arama, setArama] = useSearchParams();
  const sekme = SEKMELER.some((x) => x.kod === arama.get("sekme"))
    ? arama.get("sekme")
    : "joker";
  const sekmeSec = (kod) => setArama({ sekme: kod }, { replace: true });

  const { bakiye, tazele: coinOku } = useCoin();
  const playVar = desteklenirMi();

  const yukle = useCallback(async () => {
    try {
      const [env, rek, pak, cpak] = await Promise.all([
        supabase.rpc("envanterim"),
        supabase.rpc("reklam_durumum"),
        supabase.from("joker_paketleri").select("*").order("sira"),
        supabase.from("coin_paketleri").select("*").eq("aktif", true).order("sira"),
      ]);
      if (env.error) throw env.error;
      setEnvanter(envanterNesne(env.data));
      if (!rek.error) {
        const r = Array.isArray(rek.data) ? rek.data[0] : rek.data;
        if (r) setReklam({ bugun: r.bugun ?? 0, tavan: r.tavan ?? 5 });
      }
      if (!pak.error) setPaketler(pak.data ?? []);
      if (!cpak.error) setCoinPaketleri(cpak.data ?? []);
    } catch (e) {
      setHata(hataMesaji(e, "Dükkân yüklenemedi."));
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Play fiyatları yalnız Android uygulamasında okunabilir
  useEffect(() => {
    if (!playVar || coinPaketleri.length === 0) return;
    let aktif = true;
    fiyatlariAl(coinPaketleri.map((p) => p.urun_id))
      .then((f) => aktif && setFiyatlar(f))
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [playVar, coinPaketleri]);

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
      setBilgi(`+${s?.verilen ?? "?"} coin kazandın! (bugün ${s?.bugun ?? "?"}/${s?.tavan ?? 5})`);
      coinTazele();
      await yukle();
    } catch (e) {
      setHata(hataMesaji(e, "Reklam gösterilemedi."));
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
      const { data: oturum, error: oturumHatasi } = await supabase.auth.getSession();
      if (oturumHatasi) throw oturumHatasi;
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
      setBilgi("Satın alman tamamlandı, coin hesabına eklendi.");
      coinTazele();
      await yukle();
    } catch (e) {
      setHata(hataMesaji(e, "Satın alma tamamlanamadı."));
    } finally {
      setAlinan(null);
    }
  };

  /** Joker paketini COİN ile alır. Coin yetmezse Coin sekmesine götürür. */
  const jokerCoinIleAl = async (urunId) => {
    setHata(null);
    setBilgi(null);
    setAlinan(urunId);
    try {
      const { error } = await supabase.rpc("joker_coin_ile_al", { p_urun_id: urunId });
      if (error) throw error;
      setBilgi("Jokerler hesabına eklendi.");
      coinTazele();
      coinOku();
      await yukle();
    } catch (e) {
      const m = coinHatasi(e);
      setHata(m);
      // Buton pasif DEĞİL: basınca ne olduğu söylenir ve coin almaya götürülür.
      if (m === "Coin yetmiyor") sekmeSec("coin");
    } finally {
      setAlinan(null);
    }
  };

  const reklamKaldi = Math.max(0, (reklam.tavan ?? 5) - (reklam.bugun ?? 0));

  return (
    <div className="bd-dukkan">
      <div className="baslik">Dükkân</div>

      <div className="bd-dukkan-sekmeler" role="tablist">
        {SEKMELER.map((x) => (
          <button
            key={x.kod}
            role="tab"
            aria-selected={sekme === x.kod}
            className={"bd-dukkan-sekme" + (sekme === x.kod ? " aktif" : "")}
            onClick={() => sekmeSec(x.kod)}
          >
            <Ikon ad={x.ikon} boyut={17} />
            {x.ad}
          </button>
        ))}
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      {/* ---------- KIYAFET ---------- */}
      {sekme === "kiyafet" && (
        <div className="kart">
          <div className="bd-kat-baslik"><span>Kıyafet ve görünüm</span></div>
          <div className="alt-yazi" style={{ marginBottom: 12 }}>
            Şapka, gözlük, kıyafet ve efektler <b>Görünüm</b> sayfasından takılır.
            Sahip olmadığın eşyalar orada coin fiyatıyla kilitli görünür.
          </div>
          <Link className="btn" to={y("/gorunum")}>Görünümü aç</Link>
        </div>
      )}

      {/* ---------- Envanter ---------- */}
      {sekme === "joker" && (
      <div className="kart">
        <div className="bd-kat-baslik"><span>Envanterin</span></div>
        <div className="bd-envanter-grid">
          {Object.entries(JOKER_BILGI).map(([tur, b]) => (
            <div key={tur} className="bd-envanter-kutu">
              <span className="bd-envanter-ikon" aria-hidden="true"><Ikon ad={b.ikon} boyut={20} /></span>
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
      )}

      {/* ---------- Ödüllü video (Coin sekmesinin en üstünde) ---------- */}
      {sekme === "coin" && (
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Video izle, coin kazan</span>
          <span className="alt-yazi">bugün {reklam.bugun}/{reklam.tavan}</span>
        </div>
        <div className="alt-yazi" style={{ marginBottom: 12 }}>
          Bir video = <b>+{ODUL_COIN} coin</b>. Günde en fazla {reklam.tavan} ödül.
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
                : `Video izle (+${ODUL_COIN} coin)`}
          </button>
        )}
      </div>
      )}

      {/* ---------- Joker paketleri (COİN ile) ---------- */}
      {sekme === "joker" && (
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Joker paketleri</span>
          <span className="alt-yazi">
            <Ikon ad="coin" boyut={14} /> {(bakiye ?? 0).toLocaleString("tr-TR")}
          </span>
        </div>

        <div className="bd-paket-liste">
          {paketler.filter((p) => p.coin_fiyat != null).map((p) => (
            <div key={p.urun_id} className="bd-paket">
              <div className="bd-paket-bilgi">
                <div className="bd-paket-ad">{p.ad}</div>
                <div className="alt-yazi">{p.aciklama}</div>
                <div className="bd-paket-icerik">
                  {Object.entries(p.icerik ?? {}).map(([tur, adet]) => (
                    <span key={tur} className="bd-paket-parca">
                      <Ikon ad={JOKER_BILGI[tur]?.ikon ?? "soru"} boyut={15} /> {adet}
                    </span>
                  ))}
                </div>
              </div>
              {/* Buton PASİF DEĞİL: coin yetmezse basınca söyler ve Coin
                  sekmesine götürür (görev kuralı). */}
              <button
                className="btn kucuk"
                disabled={alinan === p.urun_id}
                onClick={() => jokerCoinIleAl(p.urun_id)}
              >
                {alinan === p.urun_id
                  ? "…"
                  : <><Ikon ad="coin" boyut={14} /> {Number(p.coin_fiyat).toLocaleString("tr-TR")}</>}
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ---------- Coin paketleri (gerçek para) ---------- */}
      {sekme === "coin" && (
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Coin paketleri</span>
          <span className="alt-yazi">
            <Ikon ad="coin" boyut={14} /> {(bakiye ?? 0).toLocaleString("tr-TR")}
          </span>
        </div>

        {!playVar && (
          <div className="bd-uyari">
            Satın alma yalnızca <b>Android uygulamasında</b> yapılabilir.
            Tarayıcıda paket satın alınamaz.
          </div>
        )}

        <div className="bd-paket-liste">
          {coinPaketleri.map((p) => {
            const f = fiyatlar[p.urun_id];
            return (
              <div key={p.urun_id} className="bd-paket bd-coin-paket">
                {/* Görsel çizilmiş (bildim/components/CoinGorseli.jsx):
                    miktar büyüdükçe yığın büyüyor, hazinede sandık çıkıyor.
                    Dışarıdan resim indirilmiyor. */}
                <span className="bd-coin-gorsel">
                  <CoinGorseli boyut={coinBoyutu(Number(p.coin) + Number(p.bonus || 0))} genislik={58} />
                </span>
                <div className="bd-paket-bilgi">
                  <div className="bd-paket-ad">{f?.ad ?? p.ad}</div>
                  <div className="bd-paket-icerik">
                    <span className="bd-paket-parca">
                      <Ikon ad="coin" boyut={15} /> {Number(p.coin).toLocaleString("tr-TR")}
                    </span>
                    {Number(p.bonus) > 0 && (
                      <span className="bd-paket-parca bd-paket-bonus">
                        +{Number(p.bonus).toLocaleString("tr-TR")} bonus
                      </span>
                    )}
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
      )}

      {/* ---------- Yasal ---------- */}
      <div className="kart bd-gizlilik-not">
        Satın alımlar Google Play üzerinden işlenir; ödeme bilgilerin Quiz Square ile
        paylaşılmaz. Tüketilebilir ürünlerde iade Google Play kurallarına tabidir.
        Ayrıntı için <Link to="/gizlilik">Gizlilik Politikası</Link>.
      </div>
    </div>
  );
}
