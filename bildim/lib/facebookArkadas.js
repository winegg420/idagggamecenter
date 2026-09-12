// ============================================================
// FACEBOOK ARKADAŞLARI — "arkadaşların Quiz Square'de" önerisi
//
// KISIT (kabul edilmiş, bilerek): Facebook 2014'ten beri TAM arkadaş
// listesi vermiyor. `/me/friends` yalnız BU UYGULAMAYI DA KULLANAN
// arkadaşları döndürür ve `user_friends` izni App Review ister.
//
//   ✅ Yapılan : eşleşen oyuncular arkadaş önerisi olarak gösterilir.
//   ❌ Yapılmayan: "tüm FB arkadaşlarını davet et" — mümkün değil; onun
//      yerine paylaşım/davet diyaloğu (bkz. facebookDavetAc).
//
// App Review onayı GELMEDEN de kırılmaz: izin ya da belirteç yoksa
// fonksiyonlar boş liste döner, arayüzdeki bölüm sessizce gizlenir,
// giriş akışı hiç etkilenmez.
// ============================================================

import { supabase } from "../../src/lib/supabase.js";

const BELIRTEC_ANAHTARI = "bildim_fb_token";
const GRAPH = "https://graph.facebook.com/v19.0";

/** Girişten hemen sonra gelen Facebook belirtecini oturumluk saklar. */
export function fbBelirteciSakla(token) {
  try {
    if (token) sessionStorage.setItem(BELIRTEC_ANAHTARI, token);
  } catch {
    /* özel mod: arkadaş önerisi bu oturumda çalışmaz, giriş etkilenmez */
  }
}

export function fbBelirteciOku() {
  try {
    return sessionStorage.getItem(BELIRTEC_ANAHTARI);
  } catch {
    return null;
  }
}

/** Oturum Facebook ile mi açıldı? (kimlik listesine bakar) */
export function facebookOturumuMu(user) {
  const kimlikler = user?.identities ?? [];
  return kimlikler.some((k) => k.provider === "facebook");
}

/** Kendi Facebook kimliğimizi profile yazar (eşleştirme için). */
export async function fbKimligiKaydet(user) {
  try {
    const kimlik = (user?.identities ?? []).find((k) => k.provider === "facebook");
    const fbId = kimlik?.id ?? kimlik?.identity_data?.sub ?? null;
    if (!fbId) return;
    const { error } = await supabase.rpc("facebook_kimligi_kaydet", { p_fb_id: String(fbId) });
    if (error) throw error;
  } catch (e) {
    console.error("[Bildim] facebook kimligi kaydedilemedi:", e);
  }
}

/**
 * Uygulamayı kullanan Facebook arkadaşları.
 * İzin yoksa ya da belirteç düştüyse BOŞ döner — hata gösterilmez.
 */
export async function facebookArkadasOnerileri() {
  const token = fbBelirteciOku();
  if (!token) return [];
  try {
    const yanit = await fetch(`${GRAPH}/me/friends?fields=id&limit=200&access_token=${encodeURIComponent(token)}`);
    if (!yanit.ok) return [];            // izin yok / belirteç bayat
    const veri = await yanit.json();
    const idler = (veri?.data ?? []).map((d) => String(d.id)).filter(Boolean);
    if (idler.length === 0) return [];

    const { data, error } = await supabase.rpc("facebook_arkadas_onerileri", {
      p_fb_idler: idler,
    });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.error("[Bildim] facebook arkadaslari alinamadi:", e);
    return [];
  }
}

/**
 * Facebook paylaşım/davet diyaloğu. "Tüm arkadaşlarını davet et" mümkün
 * olmadığı için oyuncu davet bağlantısını kendi paylaşır.
 */
export function facebookDavetAc(davetUrl) {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(davetUrl)}`;
  try {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=520");
  } catch (e) {
    console.error("[Bildim] facebook paylasimi acilamadi:", e);
  }
}
