import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import { bayrak } from "../lib/konum.js";

const HAZIR_AVATARLAR = [
  "/avatars/av1.svg",
  "/avatars/av2.svg",
  "/avatars/av3.svg",
  "/avatars/av4.svg",
  "/avatars/av5.svg",
  "/avatars/av6.svg",
  "/avatars/av7.svg",
  "/avatars/av8.svg",
];

/**
 * İlk girişte (ve takma adı olmayan mevcut üyelerde) zorunlu kurulum:
 *   1) Takma ad  2) Avatar  3) Şehir/ülke
 * Tamamlanmadan oyun ekranları açılmaz (Layout tarafından sarmalanır).
 * Gerçek ad ve Google fotoğrafı asla otomatik gösterilmez.
 */
export default function KurulumSihirbazi({ onTamam }) {
  const { user, profile, refreshProfile } = useAuth();
  const [adim, setAdim] = useState(1);
  const [takmaAd, setTakmaAd] = useState(profile?.takma_ad ?? "");
  const [secilenAvatar, setSecilenAvatar] = useState(null);
  const [googleFoto, setGoogleFoto] = useState(null);
  const [ulkeler, setUlkeler] = useState([]);
  const [sehirler, setSehirler] = useState([]);
  const [ulke, setUlke] = useState(profile?.ulke ?? "TR");
  const [sehir, setSehir] = useState(profile?.sehir ?? "");
  const [hata, setHata] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);

  // Hangi adımdan başlanacağını profil belirler (mevcut üyeler yarıda kalabilir)
  useEffect(() => {
    if (!profile) return;
    if (!profile.takma_ad_secildi) setAdim(1);
    else if (!profile.avatar_onayli) setAdim(2);
    else if (!profile.ulke) setAdim(3);
    else onTamam?.();
  }, [profile, onTamam]);

  // Google fotoğrafı yalnızca ONAY için gösterilir; DB'ye kendiliğinden yazılmaz
  useEffect(() => {
    const url =
      user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
    if (url && /^https:\/\//.test(url)) setGoogleFoto(url);
  }, [user]);

  useEffect(() => {
    if (adim !== 3) return;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("ulkeler")
          .select("kod, ad")
          .order("ad");
        if (error) throw error;
        if (aktif) setUlkeler(data ?? []);
      } catch (e) {
        if (aktif) setHata(e.message ?? "Ülke listesi yüklenemedi.");
      }
    })();
    return () => {
      aktif = false;
    };
  }, [adim]);

  useEffect(() => {
    if (adim !== 3 || !ulke) return;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("sehirler")
          .select("ad")
          .eq("ulke", ulke)
          .order("ad");
        if (error) throw error;
        if (aktif) setSehirler(data ?? []);
      } catch (e) {
        if (aktif) setHata(e.message ?? "Şehir listesi yüklenemedi.");
      }
    })();
    return () => {
      aktif = false;
    };
  }, [adim, ulke]);

  const adKaydet = async () => {
    setHata(null);
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("takma_ad_sec", { p_ad: takmaAd.trim() });
      if (error) throw error;
      await refreshProfile(user.id);
      setAdim(2);
    } catch (e) {
      setHata(e.message ?? "Takma ad kaydedilemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  const avatarKaydet = async (url) => {
    setHata(null);
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("avatar_onayla", { p_url: url });
      if (error) throw error;
      await refreshProfile(user.id);
      setAdim(3);
    } catch (e) {
      setHata(e.message ?? "Avatar kaydedilemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  const konumKaydet = async () => {
    setHata(null);
    if (!sehir.trim()) {
      setHata("Şehir seçmelisin.");
      return;
    }
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("profil_konum_kaydet", {
        p_ulke: ulke,
        p_sehir: sehir.trim(),
      });
      if (error) throw error;
      await refreshProfile(user.id);
      onTamam?.();
    } catch (e) {
      setHata(e.message ?? "Konum kaydedilemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  const serbestSehir = sehirler.length === 0;

  return (
    <div className="bd-modal-katman" role="dialog" aria-modal="true">
      <div className="bd-modal bd-sihirbaz">
        <div className="bd-adim-cizgi" aria-hidden="true">
          {[1, 2, 3].map((a) => (
            <span key={a} className={`bd-adim-nokta ${adim >= a ? "aktif" : ""}`} />
          ))}
        </div>

        {adim === 1 && (
          <>
            <div className="bd-konum-baslik">👋 Kendine bir takma ad seç</div>
            <div className="bd-konum-aciklama">
              Bildim''de <b>gerçek adın hiçbir zaman gösterilmez</b>. Diğer oyuncular
              yalnızca burada seçtiğin takma adı görür.
            </div>
            <label className="bd-alan">
              <span>Takma ad (3-16 karakter)</span>
              <input
                type="text"
                maxLength={16}
                autoFocus
                value={takmaAd}
                placeholder="ör. BilgeKartal"
                onChange={(e) => setTakmaAd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && takmaAd.trim().length >= 3 && adKaydet()}
              />
            </label>
            <div className="alt-yazi">
              Harf, rakam ve alt çizgi kullanabilirsin. Sonradan 30 günde bir değiştirilebilir.
            </div>
            {hata && <div className="hata-kutu">{hata}</div>}
            <div className="bd-konum-butonlar">
              <button
                className="btn"
                disabled={calisiyor || takmaAd.trim().length < 3}
                onClick={adKaydet}
              >
                {calisiyor ? "Kaydediliyor…" : "Devam →"}
              </button>
            </div>
          </>
        )}

        {adim === 2 && (
          <>
            <div className="bd-konum-baslik">🎭 Avatarını seç</div>
            <div className="bd-konum-aciklama">
              Hazır bir avatar seç ya da Google fotoğrafını kullanmayı onayla.
              Onaylamazsan fotoğrafın <b>kimseye gösterilmez</b>.
            </div>

            <div className="bd-avatar-grid">
              {HAZIR_AVATARLAR.map((u) => (
                <button
                  key={u}
                  className={`bd-avatar-sec ${secilenAvatar === u ? "aktif" : ""}`}
                  aria-label="Avatar seç"
                  onClick={() => setSecilenAvatar(u)}
                >
                  <img src={u} alt="" />
                </button>
              ))}
            </div>

            {hata && <div className="hata-kutu">{hata}</div>}

            <div className="bd-konum-butonlar">
              <button
                className="btn"
                disabled={calisiyor || !secilenAvatar}
                onClick={() => avatarKaydet(secilenAvatar)}
              >
                Bu avatarı kullan
              </button>
            </div>

            {googleFoto && (
              <button
                className="btn ikincil"
                style={{ marginTop: 10 }}
                disabled={calisiyor}
                onClick={() => avatarKaydet(googleFoto)}
              >
                <img
                  src={googleFoto}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ width: 24, height: 24, borderRadius: "50%" }}
                />
                Google fotoğrafımı kullan
              </button>
            )}
            <button
              className="btn ikincil"
              style={{ marginTop: 10 }}
              disabled={calisiyor}
              onClick={() => avatarKaydet(null)}
            >
              Avatarsız devam et
            </button>
          </>
        )}

        {adim === 3 && (
          <>
            <div className="bd-konum-baslik">🏙️ Hangi şehir için yarışıyorsun?</div>
            <div className="bd-konum-aciklama">
              Şehir ve ülke liglerinde bu bilgiyle yarışırsın.{" "}
              <b>Haftada yalnızca bir kez değiştirebilirsin.</b>
            </div>

            <label className="bd-alan">
              <span>Ülke</span>
              <select
                value={ulke}
                onChange={(e) => {
                  setUlke(e.target.value);
                  setSehir("");
                }}
              >
                {ulkeler.map((u) => (
                  <option key={u.kod} value={u.kod}>
                    {bayrak(u.kod)} {u.ad}
                  </option>
                ))}
              </select>
            </label>

            <label className="bd-alan">
              <span>Şehir</span>
              {serbestSehir ? (
                <input
                  type="text"
                  placeholder="Şehrini yaz"
                  maxLength={40}
                  value={sehir}
                  onChange={(e) => setSehir(e.target.value)}
                />
              ) : (
                <select value={sehir} onChange={(e) => setSehir(e.target.value)}>
                  <option value="">— Seç —</option>
                  {sehirler.map((s) => (
                    <option key={s.ad} value={s.ad}>
                      {s.ad}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {hata && <div className="hata-kutu">{hata}</div>}

            <div className="bd-konum-butonlar">
              <button className="btn" disabled={calisiyor} onClick={konumKaydet}>
                {calisiyor ? "Kaydediliyor…" : "Oyuna başla 🎮"}
              </button>
            </div>
          </>
        )}

        {profile && (
          <div className="bd-sihirbaz-onizleme">
            <Avatar profile={profile} boyut={34} />
            <span>{profile.gorunen_ad}</span>
          </div>
        )}
      </div>
    </div>
  );
}
