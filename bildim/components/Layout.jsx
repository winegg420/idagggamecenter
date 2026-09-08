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
import BildirimToast from "./BildirimToast.jsx";
import Ikon from "./Ikon.jsx";

export default function Layout() {
  const { profile, user } = useAuth();
  const [bekleyen, setBekleyen] = useState(0);
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

    const yukle = async () => {
      const [{ count: mac }, { count: istek }] = await Promise.all([
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("oyuncu2", user.id)
          .eq("durum", "bekliyor"),
        supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("addressee", user.id)
          .eq("durum", "bekliyor"),
      ]);
      if (aktif) setBekleyen((mac ?? 0) + (istek ?? 0));
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
          <Link to="/bildim" style={{ textDecoration: "none" }}>
            <span className="logo">Bildim!</span>
          </Link>
          {profile && (
            <div className="bd-topbar-sag">
              <BildirimZili />
              <Link to="/bildim/profil" className="bd-puan-link" aria-label="Profilim">
                <span className="puan-chip">
                  ⭐ <PuanSayaci deger={profile.puan} />
                </span>
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

      <nav className="tabbar">
        <NavLink to="/bildim" end className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="ev" boyut={22} /></span>Ana Sayfa
        </NavLink>
        <NavLink to="/bildim/turnuva" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kupa" boyut={22} /></span>Turnuva
        </NavLink>
        <NavLink to="/bildim/meydan" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kilic" boyut={22} /></span>Meydan Oku
          {bekleyen > 0 && <span className="rozet">{bekleyen}</span>}
        </NavLink>
        <NavLink to="/" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="oyunKolu" boyut={22} /></span>Merkez
        </NavLink>
        <NavLink to="/bildim/siralama" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="grafik" boyut={22} /></span>Sıralama
        </NavLink>
        <NavLink to="/bildim/arkadaslar" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon"><Ikon ad="kisiler" boyut={22} /></span>Arkadaşlar
        </NavLink>
      </nav>
    </div>
  );
}
