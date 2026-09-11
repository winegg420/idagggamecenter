import { Outlet, NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { supabase } from "../../src/lib/supabase.js";
import RankUpOverlay from "./RankUpOverlay.jsx";
import PuanSayaci from "./PuanSayaci.jsx";
import BildirimZili from "./BildirimZili.jsx";
import KurulumSihirbazi from "./KurulumSihirbazi.jsx";
import DavetBandi from "./DavetBandi.jsx";
import Tanitim from "./Tanitim.jsx";
import { useBildimManifest } from "../lib/manifest.js";
import BildirimToast from "./BildirimToast.jsx";
import Ikon from "./Ikon.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import Logo from "./Logo.jsx";
import SesDugmesi from "./SesDugmesi.jsx";
import TemaDugmesi from "./TemaDugmesi.jsx";
import { y, BILDIM_MOD } from "../lib/yol.js";

export default function Layout() {
  const { profile, user } = useAuth();
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
          <Link to={y()} style={{ textDecoration: "none" }} aria-label="Quizador ana sayfa">
            <Logo boyut={24} />
          </Link>
          {profile && (
            <div className="bd-topbar-sag">
              <TemaDugmesi />
              <SesDugmesi />
              <BildirimZili />
              <Link to={y("/profil")} className="bd-puan-link" aria-label="Puanım">
                <span className="puan-chip">
                  <Ikon ad="yildiz" boyut={15} /> <PuanSayaci deger={profile.puan} />
                </span>
              </Link>
              {/* Profil kapısı: takma ad, avatar ve şehir buradan değişiyor.
                  Önce yalnız puan çipinden ulaşılıyordu; kimse bulamıyordu. */}
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

      {/* Sekme dizilimi tasarım referansına getirildi: Ana Sayfa / Arkadaşlar /
          Lig / Dükkân / Profil. Turnuva ve Meydan Oku sekmeden çıktı — ikisi de
          ana ekrandaki modlar ızgarasında zaten duruyor, sekmede ikinci kez
          yer kaplıyordu. Yeni rota açılmadı; hepsi var olan yollar. */}
      <nav className="tabbar">
        <NavLink to={y()} end className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="ev" boyut={26} /></span>Ana Sayfa
        </NavLink>
        <NavLink to={y("/arkadaslar")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kisiler" boyut={26} /></span>Arkadaşlar
          {/* Bekleyen meydan okuma/arkadaş isteği: referansta sayı değil nokta */}
          {bekleyen > 0 && <span className="rozet nokta" aria-label={`${bekleyen} bekleyen`} />}
        </NavLink>
        <NavLink to={y("/siralama")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="grafik" boyut={26} /></span>Lig
        </NavLink>
        <NavLink to={y("/joker")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="yildiz" boyut={26} /></span>Dükkân
        </NavLink>
        {/* Meydan (3B buluşma alanı) — sahne lazy yüklenir, sekmeye basılmadan
            three.js inmez. Altıncı sekme; boyutlar CSS'te daraltıldı. */}
        <NavLink to={y("/harita")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="haritaPini" boyut={26} /></span>Harita
        </NavLink>
        {/* Oyun portalı sekmesi yalnız hub derlemesinde anlamlı: Quizador'un
            kendi sitesinde "/" zaten Ana Sayfa olduğundan sekme kendini
            tekrar ediyordu. Ayrıca "end" olmadığı için NavLink her yolla
            eşleşip sekmeyi sürekli "aktif" gösteriyordu — eklendi. */}
        {!BILDIM_MOD && (
          <NavLink to="/" end className={({ isActive }) => (isActive ? "aktif" : "")}>
            <span className="ikon"><Ikon ad="oyunKolu" boyut={26} /></span>Merkez
          </NavLink>
        )}
        <NavLink to={y("/profil")} className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kisi" boyut={26} /></span>Profil
        </NavLink>
      </nav>
    </div>
  );
}
