import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, supabaseHazir } from "../lib/supabase.js";
import { fbBelirteciSakla, fbKimligiKaydet, facebookOturumuMu } from "../../bildim/lib/facebookArkadas.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // (Facebook yardımcıları: arkadaş önerisi için belirteç + kimlik)
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kendi profilimiz RPC ile gelir. Tablodan `select("*")` çekmek, gerçek addan
  // türeyen `username` ve Google fotoğrafı gibi özel alanları istemciye açmak
  // demekti; o sütunlar artık başkasına kapalı (migration 081).
  const refreshProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return;
    try {
      const { data, error } = await supabase.rpc("profilim");
      if (error) throw error;
      if (data) setProfile(data);
    } catch {
      /* ağ hatası ya da RPC yoksa profil önceki hâlinde kalır */
    }
  }, []);

  useEffect(() => {
    if (!supabaseHazir) {
      setLoading(false);
      return;
    }
    const davetTalep = async (userId) => {
      const davetEden = localStorage.getItem("bildim_davet");
      if (!davetEden) return;
      if (
        davetEden === userId ||
        !/^[0-9a-f-]{36}$/i.test(davetEden)
      ) {
        localStorage.removeItem("bildim_davet");
        return;
      }
      const { data, error } = await supabase.rpc("claim_referral", {
        p_davet_eden: davetEden,
      });
      if (!error) {
        localStorage.removeItem("bildim_davet");
        if (data) refreshProfile(userId);
      }
    };

    // Davet linkiyle gelindiyse (/bildim/davet/:kod) kod saklanır; giriş
    // yapılınca arkadaşlık isteği otomatik gönderilir.
    const davetKoduUygula = async (userId) => {
      let kod = null;
      try { kod = localStorage.getItem('bildim_davet_kodu'); } catch { return; }
      if (!kod || kod.length !== 8) return;
      try {
        const { error } = await supabase.rpc('arkadas_davet_kodu_ile_ekle', { p_kod: kod });
        if (!error) {
          try { localStorage.removeItem('bildim_davet_kodu'); } catch { /* özel mod */ }
          refreshProfile(userId);
        }
      } catch {
        /* profil henüz tamamlanmamış olabilir — sonraki girişte tekrar denenir */
      }
    };

    // getSession YALNIZ oturumu kurar ve yüklemeyi kapatır.
    // Profil yükleme ve davet işleri burada DEĞİL, aşağıdaki
    // onAuthStateChange'de yapılır: supabase-js abone olunduğu anda
    // INITIAL_SESSION olayını yayınlıyor, dolayısıyla iki yol da çalışınca
    // profilim RPC'si her sayfa yüklemesinde iki kez çağrılıyordu
    // (canlı ağ denetimi). Tek kaynak onAuthStateChange.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          refreshProfile(session.user.id);
          davetTalep(session.user.id);
          davetKoduUygula(session.user.id);
          // Facebook ile girildiyse: belirteci oturumluk sakla (arkadaş
          // önerisi için gerekli) ve FB kimliğini profile yaz. Belirteç
          // YALNIZ girişin hemen ardından geliyor, sonra kayboluyor.
          if (session.provider_token && facebookOturumuMu(session.user)) {
            fbBelirteciSakla(session.provider_token);
          }
          if (facebookOturumuMu(session.user)) fbKimligiKaydet(session.user);
        } else setProfile(null);
        // Oturum yoksa da yükleme kapanmalı: kapalı oturumla açılışta
        // "Yükleniyor…" ekranında takılı kalınmasın.
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  // Online takibi (Faz 5): oturum açıkken ~60 sn'de bir kalp_at() → profiles.last_seen.
  // Tüm oyunlar bu paylaşılan kabuğu kullandığı için tek yerde yapılır.
  useEffect(() => {
    if (!supabaseHazir || !session) return;
    let durdu = false;
    const at = async () => {
      if (durdu || document.visibilityState !== "visible") return;
      try {
        await supabase.rpc("kalp_at");
      } catch {
        /* RPC yoksa (migration bekliyor) veya ağ hatası — sessiz geç */
      }
    };
    at();
    const id = setInterval(at, 60000);
    document.addEventListener("visibilitychange", at);
    return () => {
      durdu = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", at);
    };
  }, [session]);

  const signOut = () => supabase?.auth.signOut();

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
