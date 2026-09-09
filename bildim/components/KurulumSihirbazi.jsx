import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import { bayrak } from "../lib/konum.js";

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
        if (aktif) setHata(hataMesaji(e, "Ülke listesi yüklenemedi."));
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
        if (aktif) setHata(hataMesaji(e, "Şehir listesi yüklenemedi."));
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
      setHata(hataMesaji(e, "Takma ad kaydedilemedi."));
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
      setHata(hataMesaji(e, "Avatar kaydedilemedi."));
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
      setHata(hataMesaji(e, "Konum kaydedilemedi."));
    } finally {
      setCalisiyor(false);
    }
  };

  const serbestSehir = sehirler.length === 0;

  return (
    <Modal etiket="Kurulum">
      <div className="bd-modal bd-sihirbaz">
        <div className="bd-adim-cizgi" aria-hidden="true">
          {[1, 2, 3].map((a) => (
            <span key={a} className={`bd-adim-nokta ${adim >= a ? "aktif" : ""}`} />
          ))}
        </div>

        {adim === 1 && (
          <>
            <div className="bd-konum-baslik">Kendine bir takma ad seç</div>
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
              Harf, rakam ve alt çizgi kullanabilirsin. Sonradan günde bir kez değiştirilebilir.
            </div>
            {hata && <div className="hata-kutu">{hata}</div>}
            <div className="bd-konum-butonlar">
              <button
                className="btn"
                disabled={calisiyor || takmaAd.trim().length < 3}
                onClick={adKaydet}
              >
                {calisiyor ? "Kaydediliyor…" : "Devam"}
              </button>
            </div>
          </>
        )}

        {adim === 2 && (
          <>
            <div className="bd-konum-baslik">Avatarını seç</div>
            <div className="bd-konum-aciklama">
              Hazır bir avatar seç ya da Google fotoğrafını kullanmayı onayla.
              Onaylamazsan fotoğrafın <b>kimseye gösterilmez</b>.
            </div>

            <div className="bd-avatar-grid">
              {HAZIR_AVATARLAR.map((a) => (
                <button
                  key={a.url}
                  className={`bd-avatar-sec ${secilenAvatar === a.url ? "aktif" : ""}`}
                  aria-label={`${a.ad} avatarını seç`}
                  title={a.ad}
                  onClick={() => setSecilenAvatar(a.url)}
                >
                  <img src={a.url} alt="" loading="lazy" />
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
            <div className="bd-konum-baslik">Hangi şehir için yarışıyorsun?</div>
            <div className="bd-konum-aciklama">
              Şehir ve ülke liglerinde bu bilgiyle yarışırsın.{" "}
              <b>Günde yalnızca bir kez değiştirebilirsin.</b>
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
                {calisiyor ? "Kaydediliyor…" : "Oyuna başla"}
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
    </Modal>
  );
}
