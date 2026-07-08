// ============================================================
// Ana proje (Bildim) köprüsü.
// Gladius, Bildim'in Supabase client'ını ve auth oturumunu buradan alır.
// Amaç: Gladius bağımsız bir repoya taşınırsa, SADECE bu dosya değişir;
// gerisi (app/, engine/, net/, shared/) hiç dokunulmadan taşınabilir.
// ============================================================

export { supabase, supabaseHazir } from "../../src/lib/supabase.js";
export { useAuth } from "../../src/context/AuthContext.jsx";
