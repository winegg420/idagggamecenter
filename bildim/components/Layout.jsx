import { Outlet, NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { supabase } from "../../src/lib/supabase.js";
import RankUpOverlay from "./RankUpOverlay.jsx";
import PuanSayaci from "./PuanSayaci.jsx";
import BildirimZili from "./BildirimZili.jsx";
import KurulumSihirbazi from "./KurulumSihirbazi.jsx";

export default function Layout() {
  const { profile, user } = useAuth();
  const [bekleyen, setBekleyen] = useState(0);

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
      {kurulumEksik && <KurulumSihirbazi />}
      <header className="topbar">
        <Link to="/bildim" style={{ textDecoration: "none" }}>
          <span className="logo">Bildim!</span>
        </Link>
        {profile && (
          <div className="bd-topbar-sag">
            <BildirimZili />
            <Link to="/bildim/profil" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="puan-chip">
                ⭐ <PuanSayaci deger={profile.puan} />
              </span>
            </Link>
          </div>
        )}
      </header>

      <main className="sayfa">
        <Outlet />
      </main>

      <nav className="tabbar">
        <NavLink to="/bildim" end className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🏠</span>Ana Sayfa
        </NavLink>
        <NavLink to="/bildim/turnuva" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🏆</span>Turnuva
        </NavLink>
        <NavLink to="/bildim/meydan" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">⚔️</span>Meydan Oku
          {bekleyen > 0 && <span className="rozet">{bekleyen}</span>}
        </NavLink>
        <NavLink to="/" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🎮</span>Merkez
        </NavLink>
        <NavLink to="/bildim/siralama" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">📊</span>Sıralama
        </NavLink>
        <NavLink to="/bildim/arkadaslar" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">👥</span>Arkadaşlar
        </NavLink>
      </nav>
    </div>
  );
}
