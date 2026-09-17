import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { acikSaglayicilariOku, ACIK_SAGLAYICILAR } from "../../src/lib/saglayicilar.js";
import Ikon from "./Ikon.jsx";
import { tt } from "../lib/dil.js";

/**
 * Paket 20 III — misafir hesabı koruma.
 * Misafir (Supabase anonim oturumu) uygulamayı silerse ilerlemesini kaybeder. Bağlama AYNI kullanıcıya yapılır:
 *  - E-posta: `updateUser({ email })` → doğrulama bağlantısı → aynı user_id kalıcı olur.
 *  - Google: `linkIdentity` → aynı user_id'ye kimlik eklenir (Supabase'de "manual linking" açık olmalı).
 * Yeni hesap açılmaz, profiles satırı (coin, lig, sahiplikler) aynen kalır.
 *
 * Sağlayıcı doğrulanmadan yönlendirme yapılmaz (Login.jsx'teki tuzak): açık liste Auth `settings`
 * ucundan okunur; bilinmiyorsa VITE_SOSYAL kararı geçerli.
 */
const DEPO = "bildim_hesap_guvence_sorma_v1";
const oku = () => { try { return localStorage.getItem(DEPO); } catch (e) { console.warn("[Bildim] localStorage okunamadı:", e?.message ?? e); return null; } };
const yaz = () => { try { localStorage.setItem(DEPO, "1"); } catch (e) { console.warn("[Bildim] localStorage yazılamadı:", e?.message ?? e); } };

function bagHatasi(e) {
  const m = String(e?.message ?? e ?? "");
  if (/manual linking is disabled|linking.*disabled/i.test(m)) return tt("Google ile bağlama şu an kapalı. E-posta ile güvenceye alabilirsin.");
  if (/already.*(registered|exists|linked)|identity_already_exists|email_exists/i.test(m)) return tt("Bu hesap başka bir oyuncuya bağlı. Başka bir e-posta ya da Google hesabı dene.");
  if (/rate limit|too many/i.test(m)) return tt("Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.");
  if (/invalid.*email|email.*invalid/i.test(m)) return tt("E-posta adresi geçersiz görünüyor.");
  if (/network|fetch/i.test(m)) return tt("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
  return tt("Hesap bağlanamadı. Tekrar dene.");
}

export function misafirMi(user) {
  return Boolean(user?.is_anonymous);
}

/** Bağlama formu — Profil › Ayarlar kartında ve ilk galibiyet önerisinde aynı. */
function BaglamaFormu() {
  const [acik, setAcik] = useState(null);
  const [email, setEmail] = useState("");
  const [bekleyen, setBekleyen] = useState(null);
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    let aktif = true;
    acikSaglayicilariOku().then((d) => { if (aktif) setAcik(d); });
    return () => { aktif = false; };
  }, []);
  const saglayiciAcik = (ad) => (acik ? Boolean(acik[ad]) : ACIK_SAGLAYICILAR.has(ad));
  const epostaAcik = acik ? acik.email !== false : true;

  const googleBagla = async () => {
    setHata(null);
    setBekleyen("google");
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      });
      if (error) throw error;
    } catch (e) {
      console.error("[Bildim] Google bağlama başarısız:", e);
      setHata(bagHatasi(e));
      setBekleyen(null);
    }
  };

  const epostaBagla = async (ev) => {
    ev.preventDefault();
    setHata(null);
    setBekleyen("eposta");
    try {
      const { error } = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
      );
      if (error) throw error;
      setGonderildi(true);
    } catch (e) {
      console.error("[Bildim] e-posta bağlama başarısız:", e);
      setHata(bagHatasi(e));
    } finally {
      setBekleyen(null);
    }
  };

  if (gonderildi) {
    return <div className="bd-guvence-tamam">{tt("E-postana bir doğrulama bağlantısı gönderdik. Bağlantıya dokununca hesabın kalıcı olur — ilerlemen aynen kalır.")}</div>;
  }

  return (
    <div className="bd-guvence-yontemler">
      {saglayiciAcik("google") && (
        <button type="button" className="btn ikincil" disabled={!!bekleyen} onClick={googleBagla}>
          {bekleyen === "google" ? tt("Yönlendiriliyor…") : tt("Google ile bağla")}
        </button>
      )}
      {epostaAcik && (
        <form className="bd-guvence-eposta" onSubmit={epostaBagla}>
          <input type="email" required autoComplete="email" inputMode="email" placeholder={tt("E-posta adresin")}
                 aria-label={tt("E-posta adresin")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn" disabled={!!bekleyen || !email.trim()}>
            {bekleyen === "eposta" ? tt("Gönderiliyor…") : tt("E-posta ile bağla")}
          </button>
        </form>
      )}
      {!saglayiciAcik("google") && !epostaAcik && <div className="alt-yazi">{tt("Şu an açık bir bağlama yöntemi yok.")}</div>}
      {hata && <div className="hata-kutu">{hata}</div>}
    </div>
  );
}

/** Profil › Ayarlar — kalıcı giriş (yalnız misafire görünür). */
export function HesapGuvenceKarti() {
  const { user } = useAuth();
  if (!misafirMi(user)) return null;
  return (
    <div className="kart bd-guvence">
      <div className="bd-guvence-ust">
        <div className="bd-ayar-ikon"><Ikon ad="kalkan" boyut={22} /></div>
        <div>
          <div className="bd-guvence-baslik">{tt("Hesabımı güvenceye al")}</div>
          <div className="alt-yazi">{tt("Misafir hesabındasın. Uygulamayı silersen ya da başka cihaza geçersen coin, lig puanı ve eşyaların kaybolur. Bağlayınca hepsi aynen kalır.")}</div>
        </div>
      </div>
      <BaglamaFormu />
    </div>
  );
}

/** Maç sonucu — yalnız misafir KAZANDIYSA ve daha önce "Sonra" denmediyse, bir kez. */
export default function HesapGuvenceOnerisi({ kazandim }) {
  const { user } = useAuth();
  const [goster, setGoster] = useState(false);
  useEffect(() => {
    setGoster(Boolean(kazandim) && misafirMi(user) && !oku());
  }, [kazandim, user]);
  if (!goster) return null;
  return (
    <div className="kart bd-guvence bd-guvence-oneri" role="region" aria-label={tt("Hesabını güvenceye al")}>
      <div className="bd-guvence-ust">
        <div className="bd-ayar-ikon"><Ikon ad="kalkan" boyut={22} /></div>
        <div>
          <div className="bd-guvence-baslik">{tt("İlerlemeni kaybetme — hesabını güvenceye al")}</div>
          <div className="alt-yazi">{tt("Misafir olarak oynuyorsun. Bir e-posta ya da Google hesabı bağla, kazandıkların hiç kaybolmasın.")}</div>
        </div>
      </div>
      <BaglamaFormu />
      <button type="button" className="bd-bildir-vazgec" onClick={() => { yaz(); setGoster(false); }}>{tt("Sonra")}</button>
    </div>
  );
}
