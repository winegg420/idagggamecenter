// ============================================================
// DriftGP (DidaGP) kök bileşeni — IDA GG Game Center kabuğuna /driftgp/*
// altında lazy bağlanır. Bildim oturumunu (Supabase auth + profiles) kullanır;
// ayrı Google girişi / kullanıcı adı ekranı YOKTUR (tek kimlik, Faz 4).
//
// Köprü: Bildim profiles.username → DriftGP profileStore.playerName. cloudSync
// zaten supabase.auth.getUser() ile Bildim oturumunu okur (paylaşılan client),
// bu yüzden ayrı bir authStore köprüsü gerekmez — yalnızca görünen ad senkronlanır.
// Tüm DriftGP kodu bu klasörde izoledir ve yalnızca dg_ tablolarına yazar.
// ============================================================
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { useProfileStore } from "../store/profileStore.ts";
import DriftGpInner from "./DriftGpInner.tsx";
import "./styles/driftgp.css";

export default function DriftGpApp() {
  const { user, profile } = useAuth();

  // Paylaşılan kimlik: görünen ad = Bildim profiles.username (her yerde aynı).
  useEffect(() => {
    if (profile?.username) {
      try {
        useProfileStore.getState().setPlayerName(profile.username);
      } catch {
        /* store hazır değilse geç */
      }
    }
  }, [profile?.username]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="dg-root">
      <DriftGpInner />
    </div>
  );
}
