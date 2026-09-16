// ============================================================
// GARDIROP VİTRİNİ — dükkânın "Kıyafet" sekmesi
//
// Eskiden burada 2B PatiRun karakter şeridi ve kozmetik kataloğu vardı
// (AvatarVitrin + GorunumDukkani). Tek karakter sistemine geçildi: artık
// oyuncunun 3B portresi ve 3B gardırop kataloğu görünür.
//
// Katalog `avatar3d_katalogum` RPC'sinden gelir — fiyatlar ve sahiplik
// sunucunun sözü. Satın alma ve giydirme GARDIROPTA yapılır; burası
// vitrin: ne var, neyin var, neyin peşindesin.
//
// Eski bileşenler silinmedi, yalnız bu sekmeden çıktılar.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";
import KarakterPortresi from "./KarakterPortresi.jsx";
import { hataMesaji } from "../lib/hata.js";
import { GARDROP_YOLU } from "../pages/GardropaGit.jsx";
// `.bd-gardrop-*` stilleri burada; dükkân sayfası gorunum.css'i kendiliğinden
// yüklemiyor, bu yüzden bileşen kendi stilini getiriyor.
import "../pages/gorunum.css";
import { tt, ttSunucu } from "../lib/dil.js";

const YUVA_ADLARI = {
  sac: tt("Saç"), kiyafet: tt("Üst giyim"), alt: tt("Alt giyim"), ayakkabi: tt("Ayakkabı"),
  bas: tt("Baş aksesuarı"), gozluk: tt("Gözlük"), sakal: tt("Sakal"), pelerin: tt("Sırt"),
  kolye: tt("Kolye"), saat: "Saat", kupe: tt("Küpe"),
};

/** Vitrin bölümleri ve sırası; "Takı" kolye + saat + küpeyi toplar. */
const VITRIN_BOLUMLERI = [
  { anahtar: "sac", ad: tt("Saç"), yuvalar: ["sac"] },
  { anahtar: "kiyafet", ad: tt("Üst giyim"), yuvalar: ["kiyafet"] },
  { anahtar: "alt", ad: tt("Alt giyim"), yuvalar: ["alt"] },
  { anahtar: "ayakkabi", ad: tt("Ayakkabı"), yuvalar: ["ayakkabi"] },
  { anahtar: "bas", ad: tt("Baş aksesuarı"), yuvalar: ["bas"] },
  { anahtar: "gozluk", ad: tt("Gözlük"), yuvalar: ["gozluk"] },
  { anahtar: "sakal", ad: tt("Sakal"), yuvalar: ["sakal"] },
  { anahtar: "taki", ad: tt("Takı"), yuvalar: ["kolye", "saat", "kupe"] },
  { anahtar: "pelerin", ad: tt("Sırt"), yuvalar: ["pelerin"] },
];

/** Parçaları bölümlere ayırır; boş bölüm çıkmaz, bilinmeyen yuva sona eklenir. */
function vitrinGruplari(parcalar) {
  const bilinen = new Set(VITRIN_BOLUMLERI.flatMap((b) => b.yuvalar));
  const gruplar = VITRIN_BOLUMLERI
    .map((b) => ({ ...b, parcalar: parcalar.filter((p) => b.yuvalar.includes(p.yuva)) }));
  const digerYuvalar = [...new Set(parcalar.map((p) => p.yuva).filter((y) => !bilinen.has(y)))];
  for (const y of digerYuvalar) {
    gruplar.push({ anahtar: y, ad: YUVA_ADLARI[y] ?? y, parcalar: parcalar.filter((p) => p.yuva === y) });
  }
  return gruplar.filter((g) => g.parcalar.length);
}

/**
 * Satırdaki küçük eşya görseli (Paket 8): liste düz metindi, "Pantolon /
 * Şort / Kapri" birbirinin aynısı görünüyordu. Gardıroptaki kartlarla aynı
 * portre (esyaPortresi) — oyuncunun kendi ten/saç/renkleriyle.
 * three.js DİNAMİK yüklenir (KarakterPortresi deseni): portre.js'i statik
 * almak dükkân sayfasının paketine three.js'i sokardı. Paylaşılan kuyruk
 * yükü tek tek dağıtır.
 */
function EsyaOnizleme({ gorunum, parca }) {
  const [kaynak, setKaynak] = useState(null);
  const anahtar = JSON.stringify({ y: parca.yuva, d: parca.deger, g: gorunum ?? null });
  useEffect(() => {
    let atildi = false;
    setKaynak(null);
    (async () => {
      try {
        const { esyaPortresi } = await import("../avatar3d/portre.js");
        const { siraya } = await import("../avatar3d/portre-kuyrugu.js");
        siraya(() => {
          if (atildi) return;
          const veri = esyaPortresi(gorunum ?? {}, parca, 112);
          if (!atildi && veri) setKaynak(veri);
        });
      } catch (e) {
        console.error("[Dükkân] esya gorseli uretilemedi:", e);
      }
    })();
    return () => { atildi = true; };
    // `anahtar` parçayı ve görünümü temsil ediyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);
  return (
    <span className={"bd-gardrop-satir-gorsel" + (kaynak ? "" : " yukleniyor")} aria-hidden="true">
      {kaynak ? <img src={kaynak} alt="" draggable="false" /> : null}
    </span>
  );
}

export default function GardropVitrini() {
  const { profile } = useAuth();
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("avatar3d_katalogum");
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      setVeri({
        parcalar: Array.isArray(r?.avatar3d_parcalar) ? r.avatar3d_parcalar : [],
        sahip: new Set(Array.isArray(r?.avatar3d_sahip) ? r.avatar3d_sahip : []),
        kurulmus: r?.avatar3d_gorunum != null,
        gorunum: r?.avatar3d_gorunum ?? null,
      });
    } catch (e) {
      setHata(hataMesaji(e, tt("Gardırop kataloğu yüklenemedi.")));
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  if (hata) return <div className="hata-kutu">{hata}</div>;
  if (!veri) return <div className="kart"><div className="alt-yazi">{tt("Yükleniyor…")}</div></div>;

  const sahipSayisi = veri.parcalar.filter((p) => veri.sahip.has(p.id)).length;

  return (
    <>
      {/* ---- Şu anki görünüm ---- */}
      <div className="kart bd-gardrop-vitrin">
        <div className="bd-kat-baslik"><span>{tt("Şu anki karakterin")}</span></div>
        <div className="bd-gardrop-vitrin-ic">
          {/* Burada AVATAR FOTOĞRAFI DEĞİL, 3B karakterin kendisi gösterilir:
              bu sekme meydana girdiğin karakteri kurduğun yer. Listelerdeki
              avatar (Avatar.jsx) seçilen fotoğraf olmaya devam ediyor. */}
          <KarakterPortresi gorunum={veri.gorunum} boyut={96} />
          <div>
            <div className="bd-gardrop-vitrin-ad">{profile?.gorunen_ad ?? tt("Karakterin")}</div>
            <div className="alt-yazi">
              {veri.kurulmus
                ? tt("{0} / {1} parça sende", { 0: sahipSayisi, 1: veri.parcalar.length })
                : tt("Henüz karakterini kurmadın.")}
            </div>
            <a className="btn" href={GARDROP_YOLU} style={{ marginTop: 10 }}>
              {veri.kurulmus ? tt("Gardıroba git") : tt("Karakterini oluştur")}
            </a>
          </div>
        </div>
      </div>

      {/* ---- Katalog ---- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>{tt("Gardırop")}</span></div>
        {/* YUVAYA GÖRE GRUPLU (Paket 12, madde 4): tek uzun liste yerine
            bölümler; başlıkta adet, içinde ızgara. Bölümler açılıp kapanır,
            varsayılan açık. Tanınmayan yuva en sonda kendi adıyla durur. */}
        {vitrinGruplari(veri.parcalar).map((g) => (
          <details key={g.anahtar} className="bd-gardrop-grup" open>
            <summary>
              <span>{g.ad} · {g.parcalar.length}</span>
            </summary>
            <div className="bd-gardrop-liste bd-gardrop-izgara">
              {g.parcalar.map((p) => {
                const sende = veri.sahip.has(p.id);
                const odul = p.coin_fiyat == null;
                return (
                  <a
                    key={p.id}
                    className={"bd-gardrop-satir" + (sende ? " sende" : "") + (odul && !sende ? " odul" : "")}
                    href={GARDROP_YOLU}
                  >
                    <span className="bd-gardrop-satir-sol">
                      <EsyaOnizleme gorunum={veri.gorunum} parca={p} />
                      <span className="bd-gardrop-satir-ad">
                        {ttSunucu(p.ad)}
                        <small>{YUVA_ADLARI[p.yuva] ?? p.yuva}</small>
                      </span>
                    </span>
                    <span className="bd-gardrop-satir-fiyat">
                      {sende
                        ? tt("Sende")
                        : odul
                          ? <><Ikon ad="kilit" boyut={12} /> {tt("Turnuva ödülü")}</>
                          : <><Ikon ad="coin" boyut={12} /> {Number(p.coin_fiyat).toLocaleString("tr-TR")}</>}
                    </span>
                  </a>
                );
              })}
            </div>
          </details>
        ))}
        <div className="alt-yazi" style={{ marginTop: 10 }}>
          {tt("Parçalar gardıropta denenir ve satın alınır — orada karakterinin üstünde nasıl durduğunu görürsün.")}
        </div>
      </div>
    </>
  );
}
