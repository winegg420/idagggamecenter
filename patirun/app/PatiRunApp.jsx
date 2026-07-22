// ============================================================
// PatiRun kök bileşeni — IDA GG Game Center kabuğuna /patirun/* altında
// lazy bağlanır. Bildim oturumunu (Supabase auth + profiles) kullanır;
// ayrı giriş/kullanıcı adı ekranı YOKTUR (tek kimlik, Faz 4).
//
// Köprü: Bildim AuthContext'ten gelen kullanıcı + profil, PatiRun'ın
// authStore'una aktarılır; pr_users satırı (yabancı anahtar hedefi) garantilenir.
// Tüm PatiRun kodu bu klasörde izoledir ve yalnızca pr_ tablolarına yazar.
// ============================================================
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { supabase } from "../../src/lib/supabase.js";
import { useAuthStore } from "../stores/authStore.ts";
import PatiRunInner from "./PatiRunInner.tsx";
import "./styles/patirun.css";

export default function PatiRunApp() {
  const { user, profile } = useAuth();
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    let iptal = false;
    (async () => {
      let avatarId = null;
      try {
        avatarId = localStorage.getItem("patirun.avatar");
      } catch {
        /* depolama kapalı */
      }
      if (supabase) {
        try {
          // pr_users satırını garantile (FK hedefi) + kullanıcı adını profiles ile senkronla.
          await supabase
            .from("pr_users")
            .upsert({ id: user.id, username: profile.username }, { onConflict: "id" });
          const { data } = await supabase
            .from("pr_users")
            .select("avatar_id")
            .eq("id", user.id)
            .maybeSingle();
          if (data?.avatar_id) avatarId = data.avatar_id;
        } catch (e) {
          // pr_ migration'ı henüz uygulanmadıysa oyun yerel fallback'lerle açılır
          console.error("PatiRun pr_users senkron hatası:", e);
        }
      }
      if (iptal) return;
      useAuthStore.getState().setBridgedUser({
        id: user.id,
        email: user.email ?? null,
        username: profile.username ?? null,
        avatarId,
      });
      setHazir(true);
    })();
    return () => {
      iptal = true;
    };
  }, [user, profile]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="pr-root">
      {hazir ? (
        <PatiRunInner />
      ) : (
        <div className="patirun-yukleniyor" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fff", fontWeight: 700 }}>
          PatiRun yükleniyor…
        </div>
      )}
    </div>
  );
}
