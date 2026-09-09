import { useEffect, useState } from "react";
import KategoriIkon from "./KategoriIkon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";
import { sureMetni } from "../lib/konum.js";

// 31 karakter avatarı (özgün çizim SVG, tamamı yerel — dış servis yok).
// Üretici: scratchpad/avatar-uret.mjs. Eski düz siluetler (av1-av8) listeden
// çıkarıldı; dosyalar duruyor ki eski profiller kırılmasın.
const HAZIR_AVATARLAR = [
  { url: "/avatars/k01.svg", ad: "Kedi" },
  { url: "/avatars/k02.svg", ad: "Köpek" },
  { url: "/avatars/k03.svg", ad: "Baykuş" },
  { url: "/avatars/k04.svg", ad: "Tilki" },
  { url: "/avatars/k05.svg", ad: "Panda" },
  { url: "/avatars/k06.svg", ad: "Penguen" },
  { url: "/avatars/k07.svg", ad: "Kurbağa" },
  { url: "/avatars/k08.svg", ad: "Ayı" },
  { url: "/avatars/k09.svg", ad: "Maymun" },
  { url: "/avatars/k10.svg", ad: "Dinozor" },
  { url: "/avatars/k11.svg", ad: "Ejderha" },
  { url: "/avatars/k12.svg", ad: "Köpekbalığı" },
  { url: "/avatars/k13.svg", ad: "Ahtapot" },
  { url: "/avatars/k14.svg", ad: "Arı" },
  { url: "/avatars/k15.svg", ad: "Robot" },
  { url: "/avatars/k16.svg", ad: "Uzaylı" },
  { url: "/avatars/k17.svg", ad: "Astronot" },
  { url: "/avatars/k18.svg", ad: "Ninja" },
  { url: "/avatars/k19.svg", ad: "Korsan" },
  { url: "/avatars/k20.svg", ad: "Şövalye" },
  { url: "/avatars/k21.svg", ad: "Büyücü" },
  { url: "/avatars/k22.svg", ad: "Dedektif" },
  { url: "/avatars/k23.svg", ad: "Aşçı" },
  { url: "/avatars/k24.svg", ad: "Profesör" },
  { url: "/avatars/k25.svg", ad: "Viking" },
  { url: "/avatars/k26.svg", ad: "Hayalet" },
  { url: "/avatars/k27.svg", ad: "Zombi" },
  { url: "/avatars/k28.svg", ad: "Mumya" },
  { url: "/avatars/k29.svg", ad: "Kahraman" },
  { url: "/avatars/k30.svg", ad: "Palyaço" },
  { url: "/avatars/k31.svg", ad: "Kral" },
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
      setAdHata(hataMesaji(e, "Takma ad kaydedilemedi."));
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
      setAvatarHata(hataMesaji(e, "Avatar kaydedilemedi."));
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
      setKategoriHata(hataMesaji(e, "Kategori kaydedilemedi."));
    }
  };

  const davetLinki = profile.davet_kodu
    ? `${window.location.origin}/bildim/davet/${profile.davet_kodu}`
    : null;

  return (
    <>
      {/* ---------- Gizlilik açıklaması ---------- */}
      <div className="kart bd-gizlilik-not">
        <b>Gerçek adın hiçbir zaman gösterilmez.</b> Diğer oyuncular yalnızca takma
        adını ve seçtiğin avatarı görür.
      </div>

      {/* ---------- Takma ad ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Takma adın</span>
          {kalanKilit > 0 && (
            <span className="alt-yazi">{sureMetni(kalanKilit)}</span>
          )}
        </div>

        {adDuzenle ? (
          <>
            <label className="bd-alan">
              <span>Yeni takma ad (3-16)</span>
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
                Kaydet
              </button>
              <button className="btn ikincil" onClick={() => setAdDuzenle(false)}>
                Vazgeç
              </button>
            </div>
          </>
        ) : (
          <div className="bd-konum-ozet">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{profile.gorunen_ad}</div>
              <div className="alt-yazi">
                {kalanKilit > 0
                  ? `Tekrar değiştirebilmen için ${sureMetni(kalanKilit)} kaldı.`
                  : "Günde bir kez değiştirebilirsin."}
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
              Değiştir
            </button>
          </div>
        )}
      </div>

      {/* ---------- Avatar ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Avatarın</span>
        </div>
        {avatarDuzenle ? (
          <>
            <div className="bd-avatar-grid">
              {HAZIR_AVATARLAR.map((a) => (
                <button
                  key={a.url}
                  className={`bd-avatar-sec ${profile.avatar_url === a.url ? "aktif" : ""}`}
                  aria-label={`${a.ad} avatarını seç`}
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
                  Google fotoğrafım
                </button>
              )}
              <button
                className="btn ikincil"
                disabled={calisiyor}
                onClick={() => avatarKaydet(null)}
              >
                Kaldır
              </button>
              <button className="btn ikincil" onClick={() => setAvatarDuzenle(false)}>
                Kapat
              </button>
            </div>
          </>
        ) : (
          <div className="bd-konum-ozet">
            <div style={{ flex: 1 }} className="alt-yazi">
              {profile.avatar_onayli
                ? "Avatarın diğer oyunculara görünüyor."
                : "Avatar seçmedin; adının ilk harfi gösteriliyor."}
            </div>
            <button className="btn kucuk ikincil" onClick={() => setAvatarDuzenle(true)}>
              Değiştir
            </button>
          </div>
        )}
      </div>

      {/* ---------- Davet kodu ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Davet kodun</span>
        </div>
        <div className="bd-davet-kod">{profile.davet_kodu ?? "—"}</div>
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
          {kopyalandi ? "Kopyalandı" : "Davet linkini kopyala"}
        </button>
      </div>

      {/* ---------- Varsayılan kategori ---------- */}
      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Varsayılan kategorim</span>
        </div>
        <div className="alt-yazi" style={{ marginBottom: 10 }}>
          "Hemen Oyna" önce bu kategoride rakip arar.
        </div>
        <div className="bd-kat-grid">
          <button
            className={`bd-kat-kart ${!profile.tercih_kategori ? "aktif" : ""}`}
            onClick={() => kategoriKaydet(null)}
          >
            <KategoriIkon anahtar="karisik" boyut={24} plaka />
              <span className="bd-kat-ad">Karışık</span>
          </button>
          {kategorileriSirala(kategoriler).map((k) => (
            <button
              key={k.kategori}
              className={`bd-kat-kart ${profile.tercih_kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => kategoriKaydet(k.kategori)}
            >
              <KategoriIkon anahtar={k.kategori} boyut={24} plaka />
              <span className="bd-kat-ad">{kategoriEtiket(k.kategori)}</span>
              <span className="bd-kat-alt">{k.soru_sayisi} soru</span>
            </button>
          ))}
        </div>
        {kategoriHata && <div className="hata-kutu">{kategoriHata}</div>}
      </div>
    </>
  );
}
