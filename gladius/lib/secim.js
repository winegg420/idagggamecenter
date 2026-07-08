// ============================================================
// Oyuncu seçim/kişiselleştirme deposu.
// Şimdilik localStorage (reversible, DB gerektirmez). Faz 1 migration'ı
// uygulanınca gl_profil_al/gl_profil_kaydet ile senkron edilecek (TODO: DB katmanı).
// ============================================================

const ANAHTAR = "gl_secim";

export const VARSAYILAN_SECIM = {
  karakter: "maximus",
  silah: "kilic",
  silahVaryant: "kilic_1",
  kalkan: "kalkan",
  kalkanVaryant: "yuvarlak",
  amblem: "yok",
  kozmetik: {},
};

export function secimAl() {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return { ...VARSAYILAN_SECIM };
    const s = JSON.parse(ham);
    return { ...VARSAYILAN_SECIM, ...s };
  } catch (err) {
    console.error("[Gladius] seçim okunamadı:", err);
    return { ...VARSAYILAN_SECIM };
  }
}

export function secimKaydet(secim) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(secim));
    // TODO (Faz 1 sonrası): supabase.rpc('gl_profil_kaydet', {...}) ile buluta yaz.
    return true;
  } catch (err) {
    console.error("[Gladius] seçim kaydedilemedi:", err);
    return false;
  }
}
