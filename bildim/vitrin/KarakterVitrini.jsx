// ============================================================
// KARAKTER VİTRİNİ — /gorunum (Paket 17 §D)
//
// Eski gardırop (bildim/avatar3d, bildim/karakter, GardropVitrini) DONDURULDU; bu sayfa meydanın yeni karakter
// sistemiyle çizer. Tür (insan · kaplan · robot) + o sistemde modeli olan kozmetikler. Katalog sunucudan
// (vitrin_kozmetikleri): sahiplik eski parçalardan, fiyat eski katalogdan, satın alma eski avatar3d_satin_al ile —
// ekonomi aynı. Modeli olmayan yuvalar "Yakında" kilitli; ödül eşyaları "Satılmaz".
// Kayıt: meydan_gorunum_kaydet → profiles.gorunum.harita (meydan bunu okur).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { coinTazele } from "../lib/coin.js";
import { tt } from "../lib/dil.js";
import { y } from "../lib/yol.js";
import { profildenGorunum, vitrinKozmetikleri } from "../harita/karakter/meydanAvatar.js";
import "./vitrin.css";

const KADRAJ = { pelerin: "sirt", kanat: "sirt" };

export default function KarakterVitrini() {
  const { profile } = useAuth();
  const tohum = profile?.gorunen_ad ?? "";
  const kutu = useRef(null);
  const sahneRef = useRef(null);
  const [sahneHazir, setSahneHazir] = useState(false);
  const [katalog, setKatalog] = useState(null);
  const [temel, setTemel] = useState(null);           // profiles.gorunum (eski kayıt dahil; vitrin yalnız harita'yı değiştirir)
  const [tur, setTur] = useState("insan");
  const [koz, setKoz] = useState(new Set());
  const [kayitli, setKayitli] = useState(null);        // son kaydedilen {tur, koz[]} — "değişiklik var mı"
  const [portreler, setPortreler] = useState({});
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [calisan, setCalisan] = useState(null);

  // ---- katalog + mevcut görünüm
  const yukle = useCallback(async () => {
    try {
      const [{ data: k, error: e1 }, { data: g, error: e2 }] = await Promise.all([
        supabase.rpc("vitrin_katalogum"),
        supabase.rpc("esya_katalogum"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const gr = (Array.isArray(g) ? g[0] : g)?.gorunum;
      const gorunum = gr && typeof gr === "object" ? gr : {};
      setKatalog(k);
      setTemel(gorunum);
      return { k, gorunum };
    } catch (e) {
      console.error("[Vitrin] katalog alınamadı:", e);
      setHata(hataMesaji(e, tt("Vitrin yüklenemedi.")));
      return null;
    }
  }, []);

  useEffect(() => {
    let aktif = true;
    yukle().then((r) => {
      if (!aktif || !r) return;
      const sahip = new Set((r.k?.kalemler ?? []).filter((x) => x.grup === "kozmetik" && x.sahip).map((x) => x.kod));
      const h = r.gorunum.harita;
      // Başlangıç: vitrin kaydı varsa o; yoksa meydanın bugün çizdiği (eski kayıttan türetilen) — yalnız sahip olunanlar.
      const cozum = profildenGorunum(r.gorunum, tohum);
      const ilkTur = h?.tur ?? cozum.tur ?? "insan";
      const ilkKoz = Object.entries(cozum.koz ?? {}).filter(([kod, v]) => v && sahip.has(kod)).map(([kod]) => kod);
      setTur(ilkTur);
      setKoz(new Set(ilkKoz));
      const kayitliKoz = h ? vitrinKozmetikleri(h.koz ?? {}) : null;
      setKayitli(h ? { tur: h.tur, koz: Object.keys(kayitliKoz).filter((x) => kayitliKoz[x]) } : null);
    });
    return () => { aktif = false; };
  }, [yukle, tohum]);

  // ---- tek renderer'lı sahne (three.js yalnız bu sayfada, dinamik)
  useEffect(() => {
    let iptal = false, sahne = null;
    (async () => {
      try {
        const { vitrinSahnesiKur } = await import("./vitrinSahne.js");
        if (iptal || !kutu.current) return;
        sahne = await vitrinSahnesiKur(kutu.current, { tohum });
        if (iptal) { sahne.yokEt(); return; }
        sahneRef.current = sahne;
        setSahneHazir(true);
      } catch (e) {
        console.error("[Vitrin] sahne kurulamadı:", e);
        if (!iptal) setHata(tt("3B önizleme açılamadı. Kaydetmeye yine de devam edebilirsin."));
      }
    })();
    return () => { iptal = true; sahneRef.current = null; try { sahne?.yokEt(); } catch (e) { console.error("[Vitrin] sahne kapatılamadı:", e); } };
  }, [tohum]);

  const gorunumYap = useCallback((t, kozListe) => {
    const kozNesne = {};
    for (const k of kozListe) kozNesne[k] = k === "pelerin" ? "klasik" : true;
    return { ...(temel ?? {}), harita: { tur: t, koz: kozNesne } };
  }, [temel]);

  // canlı önizleme
  useEffect(() => {
    if (!sahneHazir || !temel) return;
    sahneRef.current?.goster(gorunumYap(tur, [...koz]));
  }, [sahneHazir, temel, tur, koz, gorunumYap]);

  // kart portreleri: tür başına tam boy, kozmetik başına seçili türde yalnız o kozmetik — aynı renderer, sırayla
  const kalemler = katalog?.kalemler ?? [];
  useEffect(() => {
    if (!sahneHazir || !temel || !kalemler.length) return;
    let iptal = false;
    const isler = [
      ...kalemler.filter((x) => x.grup === "tur").map((x) => [x.kod, () => gorunumYap(x.kod.replace("tur_", ""), []), "tam"]),
      ...kalemler.filter((x) => x.grup === "kozmetik" && x.durum === "aktif").map((x) => [x.kod + "@" + tur, () => gorunumYap(tur, [x.kod]), KADRAJ[x.kod] ?? "bas"]),
    ].filter(([anahtar]) => !portreler[anahtar]);
    if (!isler.length) return;
    (async () => {
      for (const [anahtar, gorunum, kadraj] of isler) {
        if (iptal) return;
        await new Promise((r) => requestAnimationFrame(r));   // her portre ayrı karede: sayfa donmasın
        const url = sahneRef.current?.portre(gorunum(), { kadraj, boyut: 192 });
        if (url && !iptal) setPortreler((p) => ({ ...p, [anahtar]: url }));
      }
    })();
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sahneHazir, temel, katalog, tur]);

  // ---- eylemler
  const turler = kalemler.filter((x) => x.grup === "tur");
  const kozmetikler = kalemler.filter((x) => x.grup === "kozmetik");
  const degisti = useMemo(() => {
    if (!kayitli) return true;
    const a = [...koz].sort().join(","), b = [...kayitli.koz].sort().join(",");
    return kayitli.tur !== tur || a !== b;
  }, [kayitli, tur, koz]);

  const takCikar = (k) => {
    setBilgi(null);
    setKoz((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(k.kod)) yeni.delete(k.kod);
      else { for (const c of k.cakisir ?? []) yeni.delete(c); yeni.add(k.kod); }
      return yeni;
    });
  };

  const satinAl = async (k) => {
    setHata(null); setBilgi(null); setCalisan(k.kod);
    try {
      const { error } = await supabase.rpc("avatar3d_satin_al", { p_id: k.satis_parca });
      if (error) throw error;
      coinTazele();
      await yukle();
      setKoz((eski) => { const yeni = new Set(eski); for (const c of k.cakisir ?? []) yeni.delete(c); yeni.add(k.kod); return yeni; });
      setBilgi(tt("{0} artık senin. Kaydetmeyi unutma.", { 0: tt(k.ad) }));
    } catch (e) {
      console.error("[Vitrin] satın alma başarısız:", e);
      setHata(hataMesaji(e, tt("Satın alınamadı.")));
    } finally {
      setCalisan(null);
    }
  };

  const kaydet = async () => {
    setHata(null); setBilgi(null); setCalisan("kaydet");
    try {
      const liste = [...koz];
      const { data, error } = await supabase.rpc("meydan_gorunum_kaydet", { p_tur: tur, p_koz: liste });
      if (error) throw error;
      setTemel((t) => ({ ...(t ?? {}), harita: data }));
      setKayitli({ tur, koz: liste });
      setBilgi(tt("Kaydedildi — meydanda böyle görüneceksin."));
    } catch (e) {
      console.error("[Vitrin] kayıt başarısız:", e);
      setHata(hataMesaji(e, tt("Kaydedilemedi.")));
    } finally {
      setCalisan(null);
    }
  };

  const durumEtiketi = (k) => {
    if (k.durum === "yakinda") return <span className="bd-vitrin-kilit"><Ikon ad="kilit" boyut={14} /> {tt("Yakında")}</span>;
    if (!k.sahip && k.odul) return <span className="bd-vitrin-kilit"><Ikon ad="kilit" boyut={14} /> {tt("Satılmaz · turnuva ödülü")}</span>;
    if (!k.sahip) {
      return (
        <button className="btn kucuk" disabled={calisan === k.kod || k.satis_parca == null} onClick={() => satinAl(k)}>
          {k.fiyat ? tt("{0} coin", { 0: Number(k.fiyat).toLocaleString(document.documentElement.lang || "tr") }) : tt("Ücretsiz al")}
        </button>
      );
    }
    const takili = koz.has(k.kod);
    return <button className={`btn kucuk ${takili ? "ikincil" : ""}`} onClick={() => takCikar(k)}>{takili ? tt("Çıkar") : tt("Tak")}</button>;
  };

  return (
    <div className="bd-vitrin">
      <h1 className="baslik">{tt("Karakterim")}</h1>
      <div className="alt-yazi">{tt("Meydanda seni bu karakter temsil eder.")}</div>

      <div className="bd-vitrin-sahne kart" ref={kutu} aria-label={tt("Karakter önizlemesi")}>
        {!sahneHazir && !hata && <div className="bd-vitrin-yukleniyor">{tt("Karakter hazırlanıyor…")}</div>}
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      <div className="bd-vitrin-kaydet">
        <button className="btn" disabled={!katalog || calisan === "kaydet" || !degisti} onClick={kaydet}>
          {calisan === "kaydet" ? tt("Kaydediliyor…") : degisti ? tt("Kaydet") : tt("Kaydedildi")}
        </button>
        <Link className="btn ikincil" to={y("/harita")}>{tt("Meydana git")}</Link>
      </div>

      <div className="kart">
        <div className="bd-kat-baslik"><span>{tt("Tür")}</span></div>
        <div className="bd-vitrin-turler">
          {turler.map((k) => {
            const kod = k.kod.replace("tur_", "");
            return (
              <button key={k.kod} className={`bd-vitrin-tur ${tur === kod ? "secili" : ""}`} aria-pressed={tur === kod} onClick={() => { setBilgi(null); setTur(kod); }}>
                <span className="bd-vitrin-portre">{portreler[k.kod] ? <img src={portreler[k.kod]} alt="" /> : null}</span>
                <span className="ad">{tt(k.ad)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="kart">
        <div className="bd-kat-baslik"><span>{tt("Kozmetikler")}</span></div>
        <div className="bd-vitrin-izgara">
          {kozmetikler.map((k) => {
            const portre = portreler[k.kod + "@" + tur];
            return (
              <div key={k.kod} className={`bd-vitrin-kart ${k.durum === "yakinda" ? "yakinda" : ""} ${koz.has(k.kod) ? "takili" : ""}`}>
                <span className="bd-vitrin-portre">
                  {k.durum === "yakinda" ? <Ikon ad="kilit" boyut={28} /> : portre ? <img src={portre} alt="" /> : null}
                </span>
                <span className="ad">{tt(k.ad)}</span>
                {k.aciklama && k.durum === "aktif" && <span className="alt-yazi">{tt(k.aciklama)}</span>}
                {durumEtiketi(k)}
              </div>
            );
          })}
        </div>
        <div className="alt-yazi" style={{ marginTop: 10 }}>
          {tt("Vitrin yeni karakterlerle yeniden kuruluyor. Kilitli yuvalar yeni parçalar üretildikçe açılacak; daha önce aldığın eşyalar hesabında duruyor.")}
        </div>
      </div>
    </div>
  );
}
