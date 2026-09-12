import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { supabase } from "../../src/lib/supabase.js";
import RankUpOverlay from "./RankUpOverlay.jsx";

import BildirimZili from "./BildirimZili.jsx";
import KurulumSihirbazi from "./KurulumSihirbazi.jsx";
import DavetBandi from "./DavetBandi.jsx";
import Tanitim from "./Tanitim.jsx";
import { useBildimManifest } from "../lib/manifest.js";
import BildirimToast from "./BildirimToast.jsx";
import Ikon from "./Ikon.jsx";
import CoinHapi from "./CoinHapi.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import Logo from "./Logo.jsx";
// SADELEŞTİRME: tema ve ses düğmeleri üst bardan Profil sayfasına
// taşındı (sadeleştirme). Bileşenler silinmedi; geri istenirse tek satır.
import { y, BILDIM_MOD } from "../lib/yol.js";
import { cihazBildir } from "../lib/cihaz.js";
import { ayarlar } from "../lib/ayarlar.js";
import { turnuvaSaatleriniAyarla } from "../lib/zaman.js";

export default function Layout() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [bekleyen, setBekleyen] = useState(0);

  // Bildim rotalarında PWA kimliği Bildim'in kendi manifesti olsun
  useBildimManifest();
  // Tanıtım yalnız ilk girişte, kurulumdan ÖNCE gösterilir
  const [tanitimGosterildi, setTanitimGosterildi] = useState(() => {
    try {
      return localStorage.getItem("bildim_tanitim") === "1";
    } catch {
      return true; // özel mod: tanıtımı zorlamayalım
    }
  });

  // Cihaz kimliği oturum başına bir kez bildirilir (sıralı maç koruması).
  useEffect(() => {
    if (!user) return;
    cihazBildir();
  }, [user?.id]);

  // İLK GİRİŞ: karakterini henüz seçmemiş oyuncu bir kez Görünüm
  // sayfasına yönlendirilir. ENGELLEME YOK — hesap açılışta rastgele bir
  // bedava karakterle geliyor (bkz. migration 158), oyuncu isterse
  // dokunmadan oynamaya devam eder.
  //
  // KURULUM BİTMEDEN YÖNLENDİRME YOK: takma ad / avatar / şehir sihirbazı
  // tam ekran bir modal katmanıdır (bd-modal-katman, position:fixed). Görünüm
  // sayfası altında açılırsa kartlar görünür ama tıklama sihirbaza gider —
  // oyuncu "karakter seçemiyorum" der. Önce sihirbaz bitsin.
  useEffect(() => {
    if (!profile) return;
    if (!profile.takma_ad_secildi || !profile.avatar_onayli || !profile.ulke) return;
    let gosterildi = true;
    try { gosterildi = localStorage.getItem("bildim_karakter_secildi") === "1"; }
    catch { /* özel mod: yönlendirme yapılmaz */ }
    if (gosterildi) return;
    try { localStorage.setItem("bildim_karakter_secildi", "1"); } catch { /* yut */ }
    navigate(y("/gorunum"));
  }, [profile?.id, profile?.takma_ad_secildi, profile?.avatar_onayli, profile?.ulke]);

  // Turnuva saatleri sunucudan (oyun_ayarlari) okunur; geri sayımlar ve
  // meydandaki kupa binası bu değerleri kullanır.
  useEffect(() => {
    ayarlar()
      .then((o) => {
        if (o?.turnuva_saat_sabah && o?.turnuva_saat_aksam) {
          turnuvaSaatleriniAyarla(o.turnuva_saat_sabah, o.turnuva_saat_aksam);
        }
      })
      .catch((e) => console.error("[Bildim] turnuva saatleri okunamadi:", e));
  }, []);

  useEffect(() => {
    if (!user) return;
    let aktif = true;

    // Bekleyen sayısı TEK sunucu çağrısıyla gelir (bkz. migration 122).
    // Eskiden iki ayrı PostgREST HEAD isteği (count=exact) atılıyordu; canlı
    // denetimde ikisi de 503 dönüyor, sayı null geliyor ve rozet hiç
    // görünmüyordu. Üstelik `error` hiç okunmadığı için hata sessizce
    // yutuluyordu — bu yüzden aylarca fark edilmemişti.
    const yukle = async () => {
      try {
        const { data, error } = await supabase.rpc("bekleyen_sayim");
        if (error) throw error;
        if (aktif) setBekleyen(Number(data) || 0);
      } catch (e) {
        // Hata olursa ÖNCEKİ değer korunur; rozet sıfıra düşüp kaybolmasın.
        console.error("[Bildim] bekleyen sayısı alınamadı:", e);
      }
    };
    yukle();

    const kanal = supabase
      .channel("bildirimler")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `oyuncu2=eq.${user.id}` },
        yukle
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `addressee=eq.${user.id}` },
        yukle
      )
      .subscribe();

    return () => {
      aktif = false;
      supabase.removeChannel(kanal);
    };
  }, [user]);

  // Zorunlu kurulum: takma ad → avatar → şehir tamamlanmadan oyun açılmaz.
  const kurulumEksik =
    Boolean(profile) &&
    (!profile.takma_ad_secildi || !profile.avatar_onayli || !profile.ulke);

  return (
    <div className="app">
      <RankUpOverlay />
      {kurulumEksik && !tanitimGosterildi ? (
        <Tanitim
          onBitti={() => {
            try {
              localStorage.setItem("bildim_tanitim", "1");
            } catch { /* özel mod */ }
            setTanitimGosterildi(true);
          }}
        />
      ) : (
        kurulumEksik && <KurulumSihirbazi />
      )}
      <div className="bd-ust-blok">
        <header className="topbar">
          <Link to={y()} style={{ textDecoration: "none" }} aria-label="Quiz Square ana sayfa">
            <Logo boyut={24} />
          </Link>
          {/* SADELEŞTİRME (12 Eylül 2026).
              Üst barda beş kontrol vardı: tema · ses · zil · coin · puan
              · avatar. Tema ve ses AYARDIR, her ekranda görünmesi gerekmez
              — ikisi de Profil sayfasında zaten duruyor (bileşenler
              silinmedi, yalnız bu barda çizilmiyor). Puan çipi de kalktı:
              aynı sayı hemen altındaki kartta büyük büyük yazıyor.
              Kalan üç öğe: bildirim, coin, profil. */}
          {profile && (
            <div className="bd-topbar-sag">
              <BildirimZili />
              <CoinHapi />
              <Link to={y("/profil")} className="bd-profil-link" aria-label="Profilim ve ayarlar" title="Profilim">
                <Avatar profile={profile} boyut={34} />
              </Link>
            </div>
          )}
        </header>

        {profile && <DavetBandi />}
        <BildirimToast />
      </div>

      <main className="sayfa">
        <Outlet />
      </main>

      {/* SADELEŞTİRME (12 Eylül 2026) — yedi sekme ALTIYA indi.
          Kaldırılan tek sekme "Merkez": Quiz Square kendi sitesinde "/"
          zaten Ana Sayfa olduğu için sekme kendini tekrar ediyordu.
          "Harita" → "Meydan": oyun içindeki adı bu.
          ARKADAŞLAR SEKMESİ KALDI — bu oyunda arkadaşlar ikincil ekran
          değil: oyuncular yalnız arkadaşlarıyla maç yapabiliyor, biri
          oyunu sırf bunun için oynuyor olabilir.
          Yeni rota açılmadı; hepsi var olan yollar. */}
      <nav className="tabbar">
        <NavLink to={y()} end className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="ev" boyut={26} /></span>Ana Sayfa
        </NavLink>
        <NavLink to={y("/arkadaslar")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kisiler" boyut={26} /></span>Arkadaşlar
          {/* Bekleyen meydan okuma/arkadaş isteği: sayı değil nokta */}
          {bekleyen > 0 && <span className="rozet nokta" aria-label={`${bekleyen} bekleyen`} />}
        </NavLink>
        <NavLink to={y("/siralama")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="grafik" boyut={26} /></span>Lig
        </NavLink>
        <NavLink to={y("/joker")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="yildiz" boyut={26} /></span>Dükkân
        </NavLink>
        {/* Meydan (3B buluşma alanı) — sahne lazy yüklenir, sekmeye
            basılmadan three.js inmez. */}
        <NavLink to={y("/harita")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="haritaPini" boyut={26} /></span>Meydan
        </NavLink>
        <NavLink to={y("/profil")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kisi" boyut={26} /></span>Profil
        </NavLink>
      </nav>
    </div>
  );
}
