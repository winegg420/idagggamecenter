import { Outlet, NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import RankUpOverlay from "./RankUpOverlay.jsx";

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

  return (
    <div className="app">
      <RankUpOverlay />
      <header className="topbar">
        <Link to="/" style={{ textDecoration: "none" }}>
          <span className="logo">Bildim!</span>
        </Link>
        {profile && (
          <Link to="/profil" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="puan-chip">⭐ {profile.puan}</span>
          </Link>
        )}
      </header>

      <main className="sayfa">
        <Outlet />
      </main>

      <nav className="tabbar">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🏠</span>Ana Sayfa
        </NavLink>
        <NavLink to="/turnuva" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🏆</span>Turnuva
        </NavLink>
        <NavLink to="/meydan" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">⚔️</span>Meydan Oku
          {bekleyen > 0 && <span className="rozet">{bekleyen}</span>}
        </NavLink>
        <NavLink to="/kafatopu" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">⚽</span>Kafa Topu
        </NavLink>
        <NavLink to="/run" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">🏃</span>RUN
        </NavLink>
        <NavLink to="/siralama" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">📊</span>Sıralama
        </NavLink>
        <NavLink to="/arkadaslar" className={({ isActive }) => (isActive ? "aktif" : "")}>
          <span className="ikon">👥</span>Arkadaşlar
        </NavLink>
      </nav>
    </div>
  );
}
