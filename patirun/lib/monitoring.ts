// Hata loglama (Supabase error_logs, minimal) + sürüm kontrolü (cache busting).
import { supabase } from './supabase';

/** Build zamanı sürüm damgası — vite.config.ts 'define' ile enjekte edilir */
declare const __APP_VERSION__: string;

const MAX_LOGS_PER_SESSION = 5;
let logged = 0;
let installed = false;

async function logError(message: string, context: string): Promise<void> {
  if (logged >= MAX_LOGS_PER_SESSION) return;
  logged += 1;
  if (!supabase) return;
  try {
    await supabase.from('pr_error_logs').insert({
      message: String(message).slice(0, 500),
      context: context.slice(0, 200),
    });
  } catch {
    // loglama asla oyunu bozmasın
  }
}

/** window hata yakalayıcıları — kritik hatalar (WebGL çökmesi vb.) kaydedilir */
export function installErrorLogging(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => {
    void logError(e.message ?? 'bilinmeyen hata', `${e.filename ?? ''}:${e.lineno ?? 0}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    void logError(reason, 'unhandledrejection');
  });
}

export function currentVersion(): string {
  try {
    return __APP_VERSION__;
  } catch {
    return 'dev';
  }
}

/**
 * Sunucudaki version.json ile karşılaştır; eski sürümse true döner.
 * version.json her build'de vite eklentisiyle üretilir.
 */
export async function checkVersion(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { version?: string };
    return !!data.version && data.version !== currentVersion();
  } catch {
    return false;
  }
}
