// Cihaz kimliği — sıralı maç kötüye kullanım koruması (sessiz).
//
// Aynı telefondan açılan iki hesap arasında sıralı maç ödül vermez. Sunucu
// bunu anlayabilsin diye tarayıcıda kalıcı, anlamsız bir kimlik tutulur ve
// oturum açıldığında bir kez sunucuya bildirilir. Kişisel veri değildir;
// yalnız "bu iki hesap aynı yerden mi geliyor" sorusunu cevaplar.

import { supabase } from "../../src/lib/supabase.js";

const ANAHTAR = "bd_cihaz_id";

export function cihazId() {
  try {
    let v = localStorage.getItem(ANAHTAR);
    if (!v) {
      v = crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
      localStorage.setItem(ANAHTAR, v);
    }
    return v;
  } catch {
    return null; // özel mod: kimlik tutulamaz, koruma yalnız IP'ye düşer
  }
}

/** Oturum başına bir kez çağrılır; başarısız olursa oyun etkilenmez. */
export async function cihazBildir() {
  try {
    const id = cihazId();
    if (!id) return;
    const { error } = await supabase.rpc("cihaz_bildir", { p_cihaz: id });
    if (error) throw error;
  } catch (e) {
    console.error("[Bildim] cihaz bildirilemedi:", e);
  }
}
