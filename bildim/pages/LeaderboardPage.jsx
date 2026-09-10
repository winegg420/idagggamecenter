import { useCallback, useEffect, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import SenRozeti from "../components/SenRozeti.jsx";
import Modal from "../components/Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";
import SayanSayi from "../components/SayanSayi.jsx";
import KonumSecici from "../components/KonumSecici.jsx";
import Maskot from "../components/Maskot.jsx";
import { bayrak, haftaBitisi, sureMetni } from "../lib/konum.js";
import { y } from "../lib/yol.js";

const KAPSAMLAR = [
  { id: "sehir", etiket: "ŞEHİR", ikon: "sehir" },
  { id: "ulke", etiket: "ÜLKE", ikon: "bayrak" },
  { id: "global", etiket: "DÜNYA", ikon: "dunya" },
  { id: "arkadas", etiket: "ARKADAŞ", ikon: "kisiler" },
];

const DONEMLER = [
  { id: "hafta", etiket: "BU HAFTA" },
  { id: "tum_zamanlar", etiket: "TÜM ZAMANLAR" },
];

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [kapsam, setKapsam] = useState("global");
  const [donem, setDonem] = useState("hafta");
  const [liste, setListe] = useState([]);
  const [sehirSirasi, setSehirSirasi] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [konumAc, setKonumAc] = useState(false);
  const [kalanHafta, setKalanHafta] = useState(() => haftaBitisi().getTime() - Date.now());

  const konumVar = Boolean(profile?.ulke && profile?.sehir);

  useEffect(() => {
    const id = setInterval(
      () => setKalanHafta(haftaBitisi().getTime() - Date.now()),
      60000
    );
    return () => clearInterval(id);
  }, []);

  const meydanOku = async (hedefId) => {
    setHata(null);
    try {
      const { data, error } = await supabase.rpc("create_challenge", {
        p_rakip: hedefId,
        p_kategori: null,
      });
      if (error) throw error;
      if (data) navigate(y(`/mac/${data}`));
    } catch (e) {
      setHata(hataMesaji(e, "Meydan okuma başlatılamadı."));
    }
  };

  // Arkadaş sekmesi eski davranışını korur (profiles üzerinden).
  const arkadasListesi = useCallback(async () => {
    const { data: dostluklar, error } = await supabase
      .from("friendships")
      .select("requester, addressee")
      .eq("durum", "arkadas")
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
    if (error) throw error;
    const idler = new Set([user.id]);
    (dostluklar ?? []).forEach((f) => {
      idler.add(f.requester);
      idler.add(f.addressee);
    });
    const kolon =
      donem === "hafta"
        ? "id, gorunen_ad, gorunen_avatar, puan, puan_hafta, sampiyonluk, sehir, ulke"
        : "id, gorunen_ad, gorunen_avatar, puan, sampiyonluk, sehir, ulke";
    const { data, error: hata2 } = await supabase
      .from("profiles")
      .select(kolon)
      .in("id", [...idler])
      .order(donem === "hafta" ? "puan_hafta" : "puan", { ascending: false });
    if (hata2) throw hata2;
    return (data ?? []).map((p, i) => ({
      sira: i + 1,
      user_id: p.id,
      gorunen_ad: p.gorunen_ad,
      gorunen_avatar: p.gorunen_avatar,
      puan: donem === "hafta" ? (p.puan_hafta ?? 0) : p.puan,
      sehir: p.sehir,
      ulke: p.ulke,
      ben: p.id === user.id,
    }));
  }, [user.id, donem]);

  useEffect(() => {
    let aktif = true;
    const yukle = async () => {
      setYukleniyor(true);
      setHata(null);
      setSehirSirasi(null);
      try {
        if (kapsam === "arkadas") {
          const satirlar = await arkadasListesi();
          if (aktif) setListe(satirlar);
        } else {
          if ((kapsam === "sehir" || kapsam === "ulke") && !konumVar) {
            if (aktif) setListe([]);
            return;
          }
          const { data, error } = await supabase.rpc("lig_siralama", {
            p_kapsam: kapsam,
            p_donem: donem,
          });
          if (error) throw error;
          if (aktif) setListe(data ?? []);

          if (kapsam === "sehir") {
            const { data: sehirler, error: sHata } = await supabase.rpc(
              "sehir_lig_sirasi",
              { p_donem: donem }
            );
            if (!sHata && aktif) {
              setSehirSirasi((sehirler ?? []).find((s) => s.benim_sehrim) ?? null);
            }
          }
        }
      } catch (e) {
        if (aktif) {
          setListe([]);
          setHata(hataMesaji(e, "Sıralama yüklenemedi."));
        }
      } finally {
        if (aktif) setYukleniyor(false);
      }
    };
    yukle();
    return () => {
      aktif = false;
    };
  }, [kapsam, donem, konumVar, arkadasListesi]);

  const benimSatirimHam = liste.find((s) => s.ben || s.user_id === user.id);
  // Kendi satırın zaten ilk 100'de görünüyorsa altta İKİNCİ KEZ sabitleme.
  const benimSatirim =
    benimSatirimHam && benimSatirimHam.sira > 100 ? benimSatirimHam : null;
  const ilk100 = liste.filter((s) => s.sira <= 100);
  const podyum = ilk100.slice(0, 3);
  const kalanlar = ilk100.slice(3);

  const satir = (s, vurgu = false) => (
    <div
      key={`${s.user_id}-${vurgu ? "ben" : "liste"}`}
      className={`bd-lig-satir ${s.user_id === user.id ? "ben" : ""}`}
    >
      <span className="bd-sira">{s.sira}</span>
      <Avatar profile={{ gorunen_ad: s.gorunen_ad, gorunen_avatar: s.gorunen_avatar }} boyut={38} />
      <div className="bd-lig-bilgi">
        <div className="bd-lig-isim">
          {s.gorunen_ad}
          {s.bot && <span className="bd-bot-rozet" title="Yapay rakip"><Ikon ad="robot" boyut={13} /></span>}
          {s.user_id === user.id && <SenRozeti />}
        </div>
        <div className="bd-lig-detay">
          <RankBadge puan={s.puan} />
          {s.ulke && (
            <span className="bd-konum-etiket">
              {bayrak(s.ulke)} {s.sehir ?? ""}
            </span>
          )}
        </div>
      </div>
      <span className="bd-lig-puan"><SayanSayi deger={s.puan} /></span>
      {s.user_id !== user.id && (
        <button
          className="bd-ikon-btn"
          title="Meydan oku"
          aria-label={`${s.gorunen_ad} oyuncusuna meydan oku`}
          onClick={() => meydanOku(s.user_id)}
        >
          <Ikon ad="kilic" boyut={17} />
        </button>
      )}
    </div>
  );

  return (
    <div className="bd-lig">
      <div className="baslik">Lig</div>

      {hata && <div className="hata-kutu">{hata}</div>}

      <div className="bd-sekme-ust">
        {KAPSAMLAR.map((k) => (
          <button
            key={k.id}
            className={`bd-sekme ${kapsam === k.id ? "aktif" : ""}`}
            onClick={() => setKapsam(k.id)}
          >
            <Ikon ad={k.ikon} boyut={15} />
            {k.etiket}
          </button>
        ))}
      </div>

      <div className="bd-sekme-alt">
        {DONEMLER.map((d) => (
          <button
            key={d.id}
            className={`bd-alt-sekme ${donem === d.id ? "aktif" : ""}`}
            onClick={() => setDonem(d.id)}
          >
            {d.etiket}
          </button>
        ))}
      </div>

      {donem === "hafta" && (
        <div className="bd-hafta-serit">
          <Ikon ad="saat" boyut={15} /> Hafta bitimine <b>{sureMetni(kalanHafta)}</b> kaldı — ilk 3 rozet kazanır.
        </div>
      )}

      {kapsam === "sehir" && sehirSirasi && (
        <div className="bd-sehir-serit">
          {bayrak(sehirSirasi.ulke)} <b>{sehirSirasi.sehir}</b>{" "}
          {donem === "hafta" ? "bu hafta" : "tüm zamanlarda"} ülkende{" "}
          <b>{sehirSirasi.sira}.</b> sırada ({sehirSirasi.sehir_sayisi} şehir içinde) ·{" "}
          {sehirSirasi.oyuncu_sayisi} oyuncu · {sehirSirasi.toplam_puan} puan
        </div>
      )}

      {(kapsam === "sehir" || kapsam === "ulke") && !konumVar ? (
        <div className="kart bd-bos">
          <Maskot poz="dusunuyor" boyut={84} className="bd-orta-maskot" />
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Şehir ve ülke ligleri için konumunu seç
          </div>
          <div className="alt-yazi" style={{ marginBottom: 12 }}>
            Hangi şehir için yarıştığını söyle, şehrinin ve ülkenin sıralamasına gir.
          </div>
          <button className="btn" onClick={() => setKonumAc(true)}>
            Şehrimi seç
          </button>
        </div>
      ) : yukleniyor ? (
        <div className="yukleniyor">Yükleniyor…</div>
      ) : ilk100.length === 0 ? (
        <div className="bd-bos-durum">
          <Maskot poz="dusunuyor" boyut={90} />
          <p>Bu ligde henüz kimse yarışmıyor — ilk sırayı sen kap.</p>
          <button className="btn" onClick={() => navigate(y())}>
            Hemen oyna
          </button>
        </div>
      ) : ilk100.length === 1 && ilk100[0].user_id === user.id ? (
        <div className="bd-lig-bos">
          <Maskot poz="selam" boyut={90} />
          <p>
            {kapsam === "sehir"
              ? "Şehrinde ilk oyuncu sensin! Arkadaşlarını çağır, şehrini zirveye taşıyın."
              : "Bu ligde şimdilik tek başınasın. Arkadaşlarını davet et."}
          </p>
          <button className="btn" onClick={() => navigate(y("/arkadaslar"))}>
            Arkadaş davet et
          </button>
          <button className="btn ikincil" onClick={() => setKapsam("global")}>
            Dünya ligine bak
          </button>
        </div>
      ) : (
        <>
          {podyum.length === 3 && (
            <div className="bd-podyum">
              {[podyum[1], podyum[0], podyum[2]].map((p, i) => {
                const basamak = [2, 1, 3][i];
                return (
                  <div
                    key={p.user_id}
                    className={`bd-podyum-yer yer-${basamak} ${
                      p.user_id === user.id ? "ben" : ""
                    } ${p.bot ? "bot" : ""}`}
                  >
                    <div className="bd-podyum-madalya">
                      {basamak}
                    </div>
                    <Avatar
                      profile={{ gorunen_ad: p.gorunen_ad, gorunen_avatar: p.gorunen_avatar }}
                      boyut={basamak === 1 ? 62 : 50}
                    />
                    {/* Botlar podyumda gerçek oyuncuların önüne geçmesin:
                        sıra ve puanları AYNEN duruyor, yalnız görsel olarak
                        ayrışıyorlar (robot rozeti + sönük renk). */}
                    <div className="bd-podyum-ad">
                      {p.gorunen_ad}
                      {p.bot && (
                        <span className="bd-bot-rozet" title="Yapay rakip">
                          <Ikon ad="robot" boyut={12} />
                        </span>
                      )}
                    </div>
                    <div className="bd-podyum-puan"><SayanSayi deger={p.puan} /></div>
                    <div className="bd-podyum-kaide">{basamak}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bd-lig-liste">
            {(podyum.length === 3 ? kalanlar : ilk100).map((s) => satir(s))}
          </div>
        </>
      )}

      {benimSatirim && !yukleniyor && (
        <div className="bd-benim-satir">{satir(benimSatirim, true)}</div>
      )}

      {konumAc && (
        <Modal onKapat={() => setKonumAc(false)} etiket="Şehir seçimi">
          <div className="bd-modal">
            <KonumSecici mod="kart" onKapat={() => setKonumAc(false)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
