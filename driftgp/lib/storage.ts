// localStorage tabanlı kalıcılık — Supabase yapılandırıldığında cloudSync üzerine ekleme yapar.

const PREFIX = 'driftgp:';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch (err) {
    console.warn(`[DidaGP] ${key} okunamadı:`, err);
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[DidaGP] ${key} kaydedilemedi:`, err);
  }
}
