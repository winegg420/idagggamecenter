// ============================================================
// GÖRÜNÜM — avatar kişiselleştirme
//
// Solda (dar ekranda üstte) dönen 3B avatar, altta yuva sekmeleri, her
// sekmede sahip olunan + satın alınabilir eşyalar. Sahip olunmayan eşya
// kilitli görünür, üstünde coin fiyatı yazar.
//
// Kaydedince iki şey olur:
//   1) gorunum_kaydet — sunucu her yuvanın SAHİPLİĞİNİ doğrular
//   2) avatarın tek karelik PNG'si üretilip Storage'a yüklenir ve
//      avatar_onayla ile profile yazılır; lig/arkadaş listeleri 3B sahne
//      açmadan bu fotoğrafı gösterir.
//
// 3B kısım LAZY yüklenir: sayfayı açmayan oyuncu three.js indirmez.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { coinTazele, coinHatasi } from "../lib/coin.js";
import { y } from "../lib/yol.js";
import "./gorunum.css";

const YUVALAR = [
  { kod: "sac", ad: "Saç", ikon: "kisi", renkAlani: "sac_renk" },
  { kod: "sapka", ad: "Şapka", ikon: "yildiz" },
  { kod: "gozluk", ad: "Gözlük", ikon: "soru" },
  { kod: "kupe", ad: "Küpe", ikon: "hediye" },
  { kod: "ust", ad: "Üst", ikon: "tisort", renkAlani: "ust_renk" },
  { kod: "ayakkabi", ad: "Ayakkabı", ikon: "kalkan" },
  { kod: "efekt", ad: "Efekt", ikon: "ates" },
];

// Boyanabilir eşyalar için 8 renklik palet (oyunun kendi tonları)
const PALET = ["#F4701F", "#FFC53D", "#2FBF71", "#4A9DD9",
               "#A855F7", "#EF4B4B", "#20324A", "#FFFFFF"];

// Ten rengi ayrı bir palet
const TEN_PALETI = ["#F3C89B", "#E8B384", "#D49A6A", "#B57A4F",
                    "#8D5524", "#5C3317", "#FFDCC0", "#C68642"];

export default function GorunumPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const kapsayiciRef = useRef(null);
  const onizlemeRef = useRef(null);

  const [katalog, setKatalog] = useState([]);
  const [sahip, setSahip] = useState([]);
  const [gorunum, setGorunum] = useState(null);
  const [bakiye, setBakiye] = useState(0);
  const [yuva, setYuva] = useState("sac");
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [alinan, setAlinan] = useState(null);
  const [sahneHatasi, setSahneHatasi] = useState(false);

  // ---------- veri ----------
  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("esya_katalogum");
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      setKatalog(Array.isArray(r?.esyalar) ? r.esyalar : []);
      setSahip(Array.isArray(r?.sahip) ? r.sahip : []);
      setGorunum(r?.gorunum && typeof r.gorunum === "object" ? r.gorunum : {});
      setBakiye(Number(r?.bakiye ?? 0));
    } catch (e) {
      setHata(hataMesaji(e, "Görünüm yüklenemedi."));
      setGorunum({});
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  // ---------- 3B önizleme (lazy) ----------
  useEffect(() => {
    const kapsayici = kapsayiciRef.current;
    if (!kapsayici || gorunum === null || katalog.length === 0) return undefined;
    let kapandi = false;
    let sahne = null;

    (async () => {
      try {
        const [{ onizlemeKur }, { esyaBilgisi }] = await Promise.all([
          import("../harita/onizleme.js"),
          import("../harita/esyalar.js"),
        ]);
        if (kapandi) return;
        sahne = onizlemeKur(kapsayici, { gorunum, bilgi: esyaBilgisi(katalog) });
        onizlemeRef.current = sahne;
      } catch (e) {
        console.error("[Görünüm] 3B sahne kurulamadi:", e);
        setSahneHatasi(true);
      }
    })();

    return () => {
      kapandi = true;
      try { sahne?.yokEt(); } catch (e) { console.error("[Görünüm] kapatma:", e); }
      onizlemeRef.current = null;
    };
    // Sahne BİR KEZ kurulur; kıyafet değişimi guncelle() ile yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorunum !== null, katalog.length]);

  // ---------- değişiklikler ----------
  const yuvaDegistir = (kod) => {
    setGorunum((g) => {
      const yeni = { ...g, [yuva]: g?.[yuva] === kod ? null : kod };
      onizlemeRef.current?.guncelle(yeni);
      return yeni;
    });
    setBilgi(null);
  };

  const renkDegistir = (alan, renk) => {
    setGorunum((g) => {
      const yeni = { ...g, [alan]: renk };
      // Ten gövdeyi de etkiler: avatar baştan kurulur.
      if (alan === "ten") onizlemeRef.current?.yenidenKur(yeni);
      else onizlemeRef.current?.guncelle(yeni);
      return yeni;
    });
  };

  const satinAl = async (kod) => {
    setHata(null); setBilgi(null); setAlinan(kod);
    try {
      const { data, error } = await supabase.rpc("esya_satin_al", { p_kod: kod });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      setBakiye(Number(r?.bakiye ?? bakiye));
      setSahip((s) => [...s, kod]);
      coinTazele();
      setBilgi("Eşya alındı, giyebilirsin.");
    } catch (e) {
      const m = coinHatasi(e);
      setHata(m);
      if (m === "Coin yetmiyor") navigate(y("/joker?sekme=coin"));
    } finally {
      setAlinan(null);
    }
  };

  /** Liste ekranları için avatarın tek karelik fotoğrafını üretip yükler. */
  const fotografiYukle = async () => {
    const s = onizlemeRef.current;
    if (!s || !user) return;
    try {
      const veri = await s.fotograf(256);
      const ikili = await (await fetch(veri)).blob();
      const yol = `${user.id}/avatar.png`;
      const { error: yuklemeHatasi } = await supabase.storage
        .from("avatarlar")
        .upload(yol, ikili, { upsert: true, contentType: "image/png" });
      if (yuklemeHatasi) throw yuklemeHatasi;
      const { data: genel } = supabase.storage.from("avatarlar").getPublicUrl(yol);
      // Önbellek kırıcı: aynı adrese yazıyoruz, tarayıcı eskisini göstermesin
      const adres = `${genel.publicUrl}?v=${Date.now()}`;
      const { error: onayHatasi } = await supabase.rpc("avatar_onayla", { p_url: adres });
      if (onayHatasi) throw onayHatasi;
      refreshProfile?.(user.id);
    } catch (e) {
      // Fotoğraf üretilemese de görünüm kaydı geçerli; sessiz geçilmez ama
      // kullanıcı akışı da durmaz.
      console.error("[Görünüm] avatar fotografi yuklenemedi:", e);
    }
  };

  const kaydet = async () => {
    setHata(null); setBilgi(null); setKaydediliyor(true);
    try {
      const { data, error } = await supabase.rpc("gorunum_kaydet", { p_gorunum: gorunum });
      if (error) throw error;
      if (data && typeof data === "object") setGorunum(data);
      await fotografiYukle();
      setBilgi("Görünümün kaydedildi.");
    } catch (e) {
      setHata(hataMesaji(e, "Görünüm kaydedilemedi."));
    } finally {
      setKaydediliyor(false);
    }
  };

  if (gorunum === null) {
    return <div className="bd-gorunum"><div className="baslik">Görünüm</div>
      <div className="alt-yazi">Yükleniyor…</div></div>;
  }

  const aktifYuva = YUVALAR.find((x) => x.kod === yuva) ?? YUVALAR[0];
  const liste = katalog.filter((e) => e.yuva === yuva);
  const secili = gorunum?.[yuva] ?? null;
  const seciliEsya = katalog.find((e) => e.kod === secili);
  const renkAlani = aktifYuva.renkAlani;
  const boyanabilirMi = Boolean(renkAlani && seciliEsya?.boyanabilir);

  return (
    <div className="bd-gorunum">
      <div className="baslik">Görünüm</div>

      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      <div className="bd-gorunum-ust">
        {/* ---- 3B önizleme ---- */}
        <div className="bd-gorunum-sahne-kutu">
          {sahneHatasi ? (
            <div className="bd-gorunum-sahnesiz">
              <Ikon ad="uyari" boyut={28} />
              <span>Cihazın 3B önizlemeyi açamıyor. Eşyaları yine de seçip kaydedebilirsin.</span>
            </div>
          ) : (
            <div className="bd-gorunum-sahne" ref={kapsayiciRef} />
          )}
        </div>

        {/* ---- coin ---- */}
        <div className="bd-gorunum-coin">
          <Ikon ad="coin" boyut={16} />
          {bakiye.toLocaleString("tr-TR")}
        </div>
      </div>

      {/* ---- yuva sekmeleri ---- */}
      <div className="bd-gorunum-yuvalar" role="tablist">
        {YUVALAR.map((x) => (
          <button
            key={x.kod}
            role="tab"
            aria-selected={yuva === x.kod}
            className={"bd-gorunum-yuva" + (yuva === x.kod ? " aktif" : "")}
            onClick={() => setYuva(x.kod)}
          >
            <Ikon ad={x.ikon} boyut={16} />
            {x.ad}
          </button>
        ))}
      </div>

      {/* ---- eşya ızgarası ---- */}
      <div className="bd-esya-grid">
        {/* "Yok" seçeneği: yuvayı boşaltır */}
        <button
          className={"bd-esya" + (secili === null ? " secili" : "")}
          onClick={() => setGorunum((g) => {
            const yeni = { ...g, [yuva]: null };
            onizlemeRef.current?.guncelle(yeni);
            return yeni;
          })}
        >
          <span className="bd-esya-gorsel"><Ikon ad="carpi" boyut={20} /></span>
          <span className="bd-esya-ad">Yok</span>
        </button>

        {liste.map((e) => {
          const sahipMi = sahip.includes(e.kod);
          const alinabilir = e.coin_fiyat != null;
          return (
            <button
              key={e.kod}
              className={"bd-esya" + (secili === e.kod ? " secili" : "") + (sahipMi ? "" : " kilitli")}
              onClick={() => (sahipMi ? yuvaDegistir(e.kod) : alinabilir ? satinAl(e.kod) : null)}
              disabled={alinan === e.kod}
            >
              <span className="bd-esya-gorsel" style={{ background: e.varsayilan_renk ?? "#DDE7F0" }}>
                {!sahipMi && <Ikon ad="kilit" boyut={16} />}
              </span>
              <span className="bd-esya-ad">{e.ad}</span>
              {!sahipMi && (
                <span className="bd-esya-fiyat">
                  {alinabilir
                    ? <><Ikon ad="coin" boyut={12} /> {Number(e.coin_fiyat).toLocaleString("tr-TR")}</>
                    : "Etkinlik ödülü"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- renk paleti ---- */}
      {boyanabilirMi && (
        <div className="kart bd-palet-kart">
          <div className="bd-kat-baslik"><span>{aktifYuva.ad} rengi</span></div>
          <div className="bd-palet">
            {PALET.map((r) => (
              <button
                key={r}
                className={"bd-palet-renk" + (gorunum?.[renkAlani] === r ? " secili" : "")}
                style={{ background: r }}
                aria-label={r}
                onClick={() => renkDegistir(renkAlani, r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---- ten rengi ---- */}
      <div className="kart bd-palet-kart">
        <div className="bd-kat-baslik"><span>Ten rengi</span></div>
        <div className="bd-palet">
          {TEN_PALETI.map((r) => (
            <button
              key={r}
              className={"bd-palet-renk" + (gorunum?.ten === r ? " secili" : "")}
              style={{ background: r }}
              aria-label={r}
              onClick={() => renkDegistir("ten", r)}
            />
          ))}
        </div>
      </div>

      <div className="bd-gorunum-eylemler">
        <button className="btn" onClick={kaydet} disabled={kaydediliyor}>
          {kaydediliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button className="btn ikincil" onClick={() => navigate(y("/profil"))}>
          Profile dön
        </button>
      </div>
    </div>
  );
}
