// ============================================================
// GÖRÜNÜM (2B) — karakter ve kozmetik seçimi
//
// PatiRun'dan taşınan vektör karakter sistemini kullanır: hazır görsel
// yok, her şey SVG olarak kodla çizilir (bildim/karakter/).
//
// Düzen: üstte yatay kaydırmalı karakter şeridi (sahip olunanlar renkli,
// olmayanlar soluk + fiyat), ortada büyük önizleme (YALNIZ AD), altta yuva
// listesi (açılır) ve renk seçici. Tanıtım cümlesi YOK: PatiRun'dan gelen
// metinler yarış oyununa aitti, bilgi yarışmasında anlamsız kalıyordu.
//
// SUNUCUYA GÜVEN: satın alma ve giyme kararını sunucu verir
// (karakter_satin_al / esya_satin_al / gorunum_kaydet). Buradaki
// kilitler yalnız oyuncuya ne olduğunu anlatmak için.
// 3B sahne YÜKLENMEZ — bu sayfa three.js indirmez.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "../components/Ikon.jsx";
import Modal from "../components/Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { coinTazele, coinHatasi } from "../lib/coin.js";
import { nadirligiUnut } from "../lib/nadirlik.js";
import { y } from "../lib/yol.js";
import { COSMETIC_COLORS, COSMETIC_LABELS, getCharacter } from "../karakter/karakterler.js";
import { YUVALAR, RENKLI_YUVALAR, avatarUri, kozmetikCoz, karakterId, renkAlani } from "../karakter/gorunum.js";
import "./gorunum.css";

/** Nadirlik → çerçeve sınıfı (AvatarCerceve ile aynı aile). */
const NADIRLIK_SINIF = { sirali: "n-sirali", ozel: "n-ozel", etkinlik: "n-etkinlik" };

export default function KarakterPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [karakterler, setKarakterler] = useState([]);
  const [karSahip, setKarSahip] = useState([]);
  const [parcalar, setParcalar] = useState([]);
  const [parcaSahip, setParcaSahip] = useState([]);
  const [bakiye, setBakiye] = useState(0);
  const [secili, setSecili] = useState(null);        // { karakter, kozmetik }
  const [acikYuva, setAcikYuva] = useState(null);
  const [onay, setOnay] = useState(null);            // satın alma onayı
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("karakter_katalogum");
      if (error) throw error;
      const k = Array.isArray(data) ? data[0] : data;
      if (!k) return;
      setKarakterler(k.karakterler ?? []);
      setKarSahip(k.karakter_sahip ?? []);
      setParcalar(k.parcalar ?? []);
      setParcaSahip(k.parca_sahip ?? []);
      setBakiye(Number(k.bakiye ?? 0));
      const g = k.gorunum ?? {};
      setSecili({ karakter: karakterId(g), kozmetik: kozmetikCoz(g) });
    } catch (e) {
      setHata(hataMesaji(e, "Görünüm yüklenemedi."));
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const parcaHaritasi = useMemo(() => {
    const m = {};
    for (const p of parcalar) m[p.yuva + ":" + p.anahtar] = p;
    return m;
  }, [parcalar]);

  const sahipMi = useCallback(
    (yuva, anahtar) => {
      if (anahtar === "yok") return true;
      const p = parcaHaritasi[yuva + ":" + anahtar];
      return Boolean(p && parcaSahip.includes(p.kod));
    },
    [parcaHaritasi, parcaSahip]
  );

  if (yukleniyor || !secili) {
    return <div className="yukleniyor">Yükleniyor…</div>;
  }

  const def = getCharacter(secili.karakter);
  const onizleme = avatarUri({ karakter: secili.karakter, kozmetik: secili.kozmetik }, "idle");

  // Karakter değiştirmek SERBEST: sahip olunanlar arasında sınırsız geçiş.
  const karakterSec = (k) => {
    setHata(null);
    if (karSahip.includes(k.id)) {
      setSecili((s) => ({ ...s, karakter: k.id }));
      return;
    }
    setOnay({ tur: "karakter", id: k.id, ad: k.ad, fiyat: Number(k.coin_fiyat ?? 0) });
  };

  const parcaSec = (yuva, anahtar) => {
    setHata(null);
    if (sahipMi(yuva, anahtar)) {
      setSecili((s) => ({ ...s, kozmetik: { ...s.kozmetik, [yuva]: anahtar } }));
      return;
    }
    const p = parcaHaritasi[yuva + ":" + anahtar];
    if (!p) return;
    if (p.coin_fiyat === null || p.coin_fiyat === undefined) {
      setHata("Bu parça yalnız turnuva ödülü olarak kazanılır.");
      return;
    }
    setOnay({ tur: "parca", kod: p.kod, yuva, anahtar, ad: p.ad, fiyat: Number(p.coin_fiyat) });
  };

  // Renk seçimi ÜCRETSİZ — sunucuya ödeme gitmez, yalnız kaydedilir.
  const renkSec = (yuva, renk) => {
    setSecili((s) => ({ ...s, kozmetik: { ...s.kozmetik, [renkAlani(yuva)]: renk } }));
  };

  const satinAl = async () => {
    if (!onay) return;
    setCalisiyor(true);
    setHata(null);
    try {
      if (onay.tur === "karakter") {
        const { error } = await supabase.rpc("karakter_satin_al", { p_id: onay.id });
        if (error) throw error;
        setKarSahip((l) => [...l, onay.id]);
        setSecili((s) => ({ ...s, karakter: onay.id }));
      } else {
        const { error } = await supabase.rpc("esya_satin_al", { p_kod: onay.kod });
        if (error) throw error;
        setParcaSahip((l) => [...l, onay.kod]);
        setSecili((s) => ({ ...s, kozmetik: { ...s.kozmetik, [onay.yuva]: onay.anahtar } }));
      }
      setBakiye((b) => b - onay.fiyat);
      coinTazele();
      setBilgi(onay.ad + " alındı.");
      setOnay(null);
    } catch (e) {
      setHata(coinHatasi(e));
    } finally {
      setCalisiyor(false);
    }
  };

  const kaydet = async () => {
    setCalisiyor(true);
    setHata(null);
    try {
      const { error } = await supabase.rpc("gorunum_kaydet", {
        p_gorunum: { karakter: secili.karakter, kozmetik: secili.kozmetik },
      });
      if (error) throw error;
      nadirligiUnut(profile?.id);
      refreshProfile?.(profile?.id);
      setBilgi("Görünümün kaydedildi.");
      try { localStorage.setItem("bildim_karakter_secildi", "1"); } catch { /* özel mod */ }
    } catch (e) {
      setHata(hataMesaji(e, "Kaydedilemedi."));
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <div className="bd-karakter-sayfa">
      <div className="baslik">Görünümün</div>
      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      {/* ---- Karakter şeridi ---- */}
      <div className="bd-kar-serit" role="listbox" aria-label="Karakterler">
        {karakterler.map((k) => {
          const bende = karSahip.includes(k.id);
          const aktif = k.id === secili.karakter;
          return (
            <button
              key={k.id}
              type="button"
              role="option"
              aria-selected={aktif}
              className={"bd-kar-kart " + (aktif ? "aktif " : "") + (bende ? "" : "kilitli ") + (NADIRLIK_SINIF[k.nadirlik] ?? "")}
              onClick={() => karakterSec(k)}
              title={k.ad}
            >
              <img src={avatarUri({ karakter: k.id }, "idle")} alt="" loading="lazy" />
              <span className="bd-kar-ad">{k.ad}</span>
              {!bende && (
                <span className="bd-kar-fiyat">
                  <Ikon ad="coin" boyut={12} /> {Number(k.coin_fiyat).toLocaleString("tr-TR")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- Büyük önizleme ---- */}
      <div className="kart bd-kar-onizleme">
        <img src={onizleme} alt={def.name} className="bd-kar-buyuk" />
        <div className="bd-kar-baslik">{def.name}</div>
        <button className="btn" disabled={calisiyor} onClick={kaydet}>
          {calisiyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>

      {/* ---- Yuvalar ---- */}
      {YUVALAR.map(({ yuva, ad }) => {
        const acik = acikYuva === yuva;
        const liste = parcalar.filter((p) => p.yuva === yuva);
        const simdiki = secili.kozmetik[yuva] ?? "yok";
        return (
          <div className="kart bd-yuva-kart" key={yuva}>
            <button
              type="button"
              className="bd-yuva-baslik"
              aria-expanded={acik}
              onClick={() => setAcikYuva(acik ? null : yuva)}
            >
              <span>{ad}</span>
              <span className="alt-yazi">{COSMETIC_LABELS[simdiki] ?? "Yok"}</span>
            </button>

            {acik && (
              <>
                <div className="bd-parca-grid">
                  <button
                    type="button"
                    className={"bd-parca " + (simdiki === "yok" ? "aktif" : "")}
                    onClick={() => parcaSec(yuva, "yok")}
                  >
                    <span className="bd-parca-ad">Yok</span>
                  </button>
                  {liste.map((p) => {
                    const bende = parcaSahip.includes(p.kod);
                    const etkinlik = p.coin_fiyat === null || p.coin_fiyat === undefined;
                    return (
                      <button
                        key={p.kod}
                        type="button"
                        className={"bd-parca " + (simdiki === p.anahtar ? "aktif " : "") + (bende ? "" : "kilitli ") + (NADIRLIK_SINIF[p.nadirlik] ?? "")}
                        onClick={() => parcaSec(yuva, p.anahtar)}
                        title={p.ad}
                      >
                        <img
                          src={avatarUri(
                            { karakter: secili.karakter, kozmetik: { ...secili.kozmetik, [yuva]: p.anahtar } },
                            "idle"
                          )}
                          alt=""
                          loading="lazy"
                        />
                        <span className="bd-parca-ad">{p.ad}</span>
                        {!bende && (
                          <span className="bd-parca-fiyat">
                            {etkinlik ? (
                              <><Ikon ad="kilit" boyut={11} /> Etkinlik ödülü</>
                            ) : (
                              <><Ikon ad="coin" boyut={11} /> {Number(p.coin_fiyat).toLocaleString("tr-TR")}</>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Renk ÜCRETSİZ: parça satılır, rengi hediye edilir. */}
                {RENKLI_YUVALAR.has(yuva) && (
                  <div className="bd-renk-satir" role="group" aria-label={ad + " rengi"}>
                    {COSMETIC_COLORS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={"bd-renk " + (secili.kozmetik[renkAlani(yuva)] === r ? "aktif" : "")}
                        style={{ background: r }}
                        aria-label={"Renk " + r}
                        onClick={() => renkSec(yuva, r)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="alt-yazi" style={{ textAlign: "center", margin: "12px 0 4px" }}>
        Coin bakiyen: <b>{bakiye.toLocaleString("tr-TR")}</b> · Renkler ücretsiz
      </div>
      <button className="btn ikincil" onClick={() => navigate(y("/joker?sekme=gorunum"))}>
        Dükkânda tüm parçalar
      </button>

      {onay && (
        <Modal onKapat={() => setOnay(null)} etiket="Satın alma">
          <div className="bd-modal">
            <div className="baslik">{onay.ad}</div>
            <div className="alt-yazi" style={{ marginBottom: 12 }}>
              Fiyat: <b>{onay.fiyat.toLocaleString("tr-TR")} coin</b> · Bakiyen:{" "}
              <b>{bakiye.toLocaleString("tr-TR")} coin</b>
            </div>
            {bakiye < onay.fiyat && (
              <div className="hata-kutu" style={{ marginBottom: 10 }}>Coinin yetmiyor.</div>
            )}
            <div className="bd-konum-butonlar">
              <button className="btn" disabled={calisiyor || bakiye < onay.fiyat} onClick={satinAl}>
                {calisiyor ? "…" : "Satın al"}
              </button>
              <button className="btn ikincil" onClick={() => setOnay(null)}>Vazgeç</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
