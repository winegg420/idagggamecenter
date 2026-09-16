import { useEffect, useState } from "react";
import KategoriIkon from "./KategoriIkon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";
import { sureMetni } from "../lib/konum.js";
import { y } from "../lib/yol.js";
import DavetKodu from "./DavetKodu.jsx";
import { tt } from "../lib/dil.js";

// 31 karakter avatarı (özgün çizim SVG, tamamı yerel — dış servis yok).
// Üretici: scratchpad/avatar-uret.mjs. Eski düz siluetler (av1-av8) listeden
// çıkarıldı; dosyalar duruyor ki eski profiller kırılmasın.
const HAZIR_AVATARLAR = [
  { url: "/avatars/k01.svg", ad: tt("Kedi") },
  { url: "/avatars/k02.svg", ad: tt("Köpek") },
  { url: "/avatars/k03.svg", ad: tt("Baykuş") },
  { url: "/avatars/k04.svg", ad: tt("Tilki") },
  { url: "/avatars/k05.svg", ad: tt("Panda") },
  { url: "/avatars/k06.svg", ad: tt("Penguen") },
  { url: "/avatars/k07.svg", ad: tt("Kurbağa") },
  { url: "/avatars/k08.svg", ad: tt("Ayı") },
  { url: "/avatars/k09.svg", ad: tt("Maymun") },
  { url: "/avatars/k10.svg", ad: tt("Dinozor") },
  { url: "/avatars/k11.svg", ad: tt("Ejderha") },
  { url: "/avatars/k12.svg", ad: tt("Köpekbalığı") },
  { url: "/avatars/k13.svg", ad: tt("Ahtapot") },
  { url: "/avatars/k14.svg", ad: tt("Arı") },
  { url: "/avatars/k15.svg", ad: tt("Robot") },
  { url: "/avatars/k16.svg", ad: tt("Uzaylı") },
  { url: "/avatars/k17.svg", ad: tt("Astronot") },
  { url: "/avatars/k18.svg", ad: tt("Ninja") },
  { url: "/avatars/k19.svg", ad: tt("Korsan") },
  { url: "/avatars/k20.svg", ad: tt("Şövalye") },
  { url: "/avatars/k21.svg", ad: tt("Büyücü") },
  { url: "/avatars/k22.svg", ad: tt("Dedektif") },
  { url: "/avatars/k23.svg", ad: tt("Aşçı") },
  { url: "/avatars/k24.svg", ad: tt("Profesör") },
  { url: "/avatars/k25.svg", ad: tt("Viking") },
  { url: "/avatars/k26.svg", ad: tt("Hayalet") },
  { url: "/avatars/k27.svg", ad: tt("Zombi") },
  { url: "/avatars/k28.svg", ad: tt("Mumya") },
  { url: "/avatars/k29.svg", ad: tt("Kahraman") },
  { url: "/avatars/k30.svg", ad: tt("Palyaço") },
  { url: "/avatars/k31.svg", ad: tt("Kral") },
];

// Takma ad günde bir kez değişir (sunucudaki takma_ad_sec ile aynı pencere).
const TAKMA_AD_KILIT_MS = 24 * 60 * 60 * 1000;

/** Profil sayfasındaki kimlik ayarları: takma ad, avatar, davet kodu, varsayılan kategori. */
export default function ProfilAyarlari() {
  const { user, profile, refreshProfile } = useAuth();
  const [yeniAd, setYeniAd] = useState("");
  const [adDuzenle, setAdDuzenle] = useState(false);
  const [adHata, setAdHata] = useState(null);
  const [avatarDuzenle, setAvatarDuzenle] = useState(false);
  const [avatarHata, setAvatarHata] = useState(null);
  const [kategoriler, setKategoriler] = useState([]);
  const [kategoriHata, setKategoriHata] = useState(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);

  // Meydanda ikram alma tercihi (varsayılan AÇIK = rahatsiz_etme false).
  // Karar sunucuda: ikram_gonder kapalıysa reddediyor (bkz. migration 153).
  const [rahatsizEtme, setRahatsizEtme] = useState(Boolean(profile?.rahatsiz_etme));
  const [ikramCalisiyor, setIkramCalisiyor] = useState(false);
  const [ikramHata, setIkramHata] = useState(null);

  useEffect(() => {
    setRahatsizEtme(Boolean(profile?.rahatsiz_etme));
  }, [profile?.rahatsiz_etme]);

  const rahatsizEtmeDegistir = async () => {
    setIkramHata(null);
    setIkramCalisiyor(true);
    const yeni = !rahatsizEtme;
    try {
      const { data, error } = await supabase.rpc("rahatsiz_etme_ayarla", { p_kapali: yeni });
      if (error) throw error;
      setRahatsizEtme(Boolean(data));
      refreshProfile?.(profile?.id);
    } catch (e) {
      setIkramHata(hataMesaji(e, tt("Ayar kaydedilemedi.")));
    } finally {
      setIkramCalisiyor(false);
    }
  };

  useEffect(() => {
    supabase
      .rpc("get_categories")
      .then(({ data }) => setKategoriler(data ?? []))
      .catch(() => setKategoriler([]));
  }, []);

  if (!profile) return null;

  const kalanKilit = profile.takma_ad_degisti_at
    ? Math.max(
        0,
        new Date(profile.takma_ad_degisti_at).getTime() + TAKMA_AD_KILIT_MS - Date.now()
      )
    : 0;

  const googleFoto =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

  const adKaydet = async () => {
    setAdHata(null);
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("takma_ad_sec", { p_ad: yeniAd.trim() });
      if (error) throw error;
      await refreshProfile(user.id);
      setAdDuzenle(false);
    } catch (e) {
      setAdHata(hataMesaji(e, tt("Takma ad kaydedilemedi.")));
    } finally {
      setCalisiyor(false);
    }
  };

  const avatarKaydet = async (url) => {
    setAvatarHata(null);
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("avatar_onayla", { p_url: url });
      if (error) throw error;
      await refreshProfile(user.id);
      setAvatarDuzenle(false);
    } catch (e) {
      setAvatarHata(hataMesaji(e, tt("Avatar kaydedilemedi.")));
    } finally {
      setCalisiyor(false);
    }
  };

  const kategoriKaydet = async (kategori) => {
    setKategoriHata(null);
    try {
      const { error } = await supabase.rpc("tercih_kategori_kaydet", {
        p_kategori: kategori,
      });
      if (error) throw error;
      await refreshProfile(user.id);
    } catch (e) {
      setKategoriHata(hataMesaji(e, tt("Kategori kaydedilemedi.")));
    }
  };

  const davetLinki = profile.davet_kodu
    ? window.location.origin + y(`/davet/${profile.davet_kodu}`)
    : null;

  return (
    <>
      {/* ---------- Meydanda rahatsız etme ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>{tt("Meydanda ikramlar")}</span></div>
        <div className="bd-konum-ozet">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>
              {rahatsizEtme ? tt("Kapalı — kimse ikram gönderemez") : tt("Açık — kahve ve balon alabilirsin")}
            </div>
            <div className="alt-yazi">
              {tt("Meydanda başka oyuncular sana kahve ya da balon ikram edebilir. Rahatsız olursan burayı kapat; meydan okumalar etkilenmez.")}
            </div>
          </div>
          <button
            className={`btn kucuk ${rahatsizEtme ? "" : "ikincil"}`}
            disabled={ikramCalisiyor}
            onClick={rahatsizEtmeDegistir}
          >
            {rahatsizEtme ? tt("Aç") : tt("Kapat")}
          </button>
        </div>
        {ikramHata && <div className="hata-kutu" style={{ marginTop: 8 }}>{ikramHata}</div>}
      </div>

      {/* ---------- Takma ad ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>{tt("Takma adın")}</span>
          {kalanKilit > 0 && (
            <span className="alt-yazi">{sureMetni(kalanKilit)}</span>
          )}
        </div>
        {/* GİZLİLİK NOTU: eskiden istatistiklerin hemen altında iki
            satırlık ayrı bir gri bloktu ve bir AYAR sanılıyordu. Bu bir
            bilgi notu — ait olduğu yere, takma ad ayarının altına indi. */}
        <p className="bd-gizlilik-not">
          {tt("Gerçek adın hiçbir zaman gösterilmez; diğer oyuncular yalnızca takma adını ve seçtiğin avatarı görür.")}
        </p>

        {adDuzenle ? (
          <>
            <label className="bd-alan">
              <span>{tt("Yeni takma ad (3-16)")}</span>
              <input
                type="text"
                maxLength={16}
                autoFocus
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adKaydet()}
              />
            </label>
            {adHata && <div className="hata-kutu">{adHata}</div>}
            <div className="bd-konum-butonlar">
              <button className="btn" disabled={calisiyor} onClick={adKaydet}>
                {tt("Kaydet")}
              </button>
              <button className="btn ikincil" onClick={() => setAdDuzenle(false)}>
                {tt("Vazgeç")}
              </button>
            </div>
          </>
        ) : (
          <div className="bd-konum-ozet">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{profile.gorunen_ad}</div>
              <div className="alt-yazi">
                {kalanKilit > 0
                  ? tt("Tekrar değiştirebilmen için {0} kaldı.", { 0: sureMetni(kalanKilit) })
                  : tt("Günde bir kez değiştirebilirsin.")}
              </div>
            </div>
            <button
              className="btn kucuk ikincil"
              disabled={kalanKilit > 0}
              onClick={() => {
                setYeniAd(profile.takma_ad ?? "");
                setAdDuzenle(true);
              }}
            >
              {tt("Değiştir")}
            </button>
          </div>
        )}
      </div>

      {/* ---------- Avatar ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>{tt("Avatarın")}</span>
        </div>
        {avatarDuzenle ? (
          <>
            <div className="bd-avatar-grid">
              {HAZIR_AVATARLAR.map((a) => (
                <button
                  key={a.url}
                  className={`bd-avatar-sec ${profile.avatar_url === a.url ? "aktif" : ""}`}
                  aria-label={tt("{0} avatarını seç", { 0: a.ad })}
                  title={a.ad}
                  disabled={calisiyor}
                  onClick={() => avatarKaydet(a.url)}
                >
                  <img src={a.url} alt="" />
                </button>
              ))}
            </div>
            {avatarHata && <div className="hata-kutu">{avatarHata}</div>}
            <div className="bd-konum-butonlar">
              {googleFoto && (
                <button
                  className="btn ikincil"
                  disabled={calisiyor}
                  onClick={() => avatarKaydet(googleFoto)}
                >
                  {tt("Google fotoğrafım")}
                </button>
              )}
              <button
                className="btn ikincil"
                disabled={calisiyor}
                onClick={() => avatarKaydet(null)}
              >
                {tt("Kaldır")}
              </button>
              <button className="btn ikincil" onClick={() => setAvatarDuzenle(false)}>
                {tt("Kapat")}
              </button>
            </div>
          </>
        ) : (
          <div className="bd-konum-ozet">
            <div style={{ flex: 1 }} className="alt-yazi">
              {profile.avatar_onayli
                ? tt("Avatarın diğer oyunculara görünüyor.")
                : tt("Avatar seçmedin; adının ilk harfi gösteriliyor.")}
            </div>
            <button className="btn kucuk ikincil" onClick={() => setAvatarDuzenle(true)}>
              {tt("Değiştir")}
            </button>
          </div>
        )}
      </div>

      {/* ---------- Davet kodu ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>{tt("Davet kodun")}</span>
        </div>
        {/* Kodun kendisi düğme: dokununca YALNIZ kod panoya gider. */}
        <DavetKodu kod={profile.davet_kodu} />
        <button
          className="btn ikincil"
          style={{ marginTop: 10 }}
          disabled={!davetLinki}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(davetLinki);
              setKopyalandi(true);
              setTimeout(() => setKopyalandi(false), 2500);
            } catch {
              /* pano izni yok */
            }
          }}
        >
          {kopyalandi ? tt("Kopyalandı") : tt("Davet linkini kopyala")}
        </button>
      </div>

      {/* ---------- Varsayılan kategori ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>{tt("Varsayılan kategorim")}</span>
        </div>
        <div className="alt-yazi" style={{ marginBottom: 10 }}>
          {tt("\"Hemen Oyna\" ve \"Dereceli Maç\" bu kategoride rakip arar. Ana Sayfa'dan da değiştirebilirsin.")}
        </div>
        <div className="bd-kat-grid">
          <button
            className={`bd-kat-kart ${!profile.tercih_kategori ? "aktif" : ""}`}
            onClick={() => kategoriKaydet(null)}
          >
            <KategoriIkon anahtar="karisik" boyut={24} plaka />
              <span className="bd-kat-ad">{tt("Karışık")}</span>
          </button>
          {kategorileriSirala(kategoriler).map((k) => (
            <button
              key={k.kategori}
              className={`bd-kat-kart ${profile.tercih_kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => kategoriKaydet(k.kategori)}
            >
              <KategoriIkon anahtar={k.kategori} boyut={24} plaka />
              <span className="bd-kat-ad">{kategoriEtiket(k.kategori)}</span>
              <span className="bd-kat-alt">{k.soru_sayisi} {tt("soru")}</span>
            </button>
          ))}
        </div>
        {kategoriHata && <div className="hata-kutu">{kategoriHata}</div>}
      </div>
    </>
  );
}
