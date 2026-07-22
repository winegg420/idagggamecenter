// Supabase bulut senkronu — istemci yapılandırılmamışsa veya oturum yoksa sessizce no-op.
// Şema: supabase/schema.sql (kullanıcı Supabase projesine uygulayacak).

import { supabase } from './supabase';
import type { CarCustomization } from '../game/types';
import type { GhostData } from '../game/ghost';

// Oyun sahibinin hayalet kimliği — yalnızca bu hesabın en iyi sürüşleri buluta hayalet
// olarak yazılır; HERKES (misafir dahil) bu hayaleti yarışında görür.
export const OWNER_EMAIL = 'idagureli@gmail.com';
export const OWNER_GHOST_NAME = 'idagg';

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function syncProfile(profile: unknown): Promise<void> {
  const uid = await userId();
  if (!supabase || !uid) return;
  try {
    const { error } = await supabase
      .from('dg_profiles')
      .upsert({ id: uid, data: profile, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    console.warn('[DidaGP] Profil buluta yazılamadı:', err);
  }
}

export async function loadCloudProfile(): Promise<unknown | null> {
  const uid = await userId();
  if (!supabase || !uid) return null;
  try {
    const { data, error } = await supabase.from('dg_profiles').select('data').eq('id', uid).maybeSingle();
    if (error) throw error;
    return data?.data ?? null;
  } catch (err) {
    console.warn('[DidaGP] Bulut profili okunamadı:', err);
    return null;
  }
}

export async function syncCustomization(carId: string, custom: CarCustomization): Promise<void> {
  const uid = await userId();
  if (!supabase || !uid) return;
  try {
    const { error } = await supabase
      .from('dg_customizations')
      .upsert({ user_id: uid, car_id: carId, data: custom, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    console.warn('[DidaGP] Kişiselleştirme buluta yazılamadı:', err);
  }
}

export async function saveRaceResult(result: {
  trackId: string;
  carId: string;
  position: number;
  raceTime: number;
  bestLap: number;
  driftScore: number;
}): Promise<void> {
  const uid = await userId();
  if (!supabase || !uid) return;
  try {
    const { error } = await supabase.from('dg_race_results').insert({
      user_id: uid,
      track_id: result.trackId,
      car_id: result.carId,
      position: result.position,
      race_time: result.raceTime,
      best_lap: result.bestLap,
      drift_score: Math.round(result.driftScore),
    });
    if (error) throw error;
  } catch (err) {
    console.warn('[DidaGP] Yarış sonucu buluta yazılamadı:', err);
  }
}

/** Pist+tur kombinasyonu için kayıtlı hayaleti getirir (tablo yoksa/hata olursa sessizce null). */
export async function fetchGhost(trackId: string, laps: number): Promise<GhostData | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('dg_ghosts')
      .select('name, car_id, paint_color, race_time, dt, samples')
      .eq('track_id', trackId)
      .eq('laps', laps)
      .maybeSingle();
    if (error) throw error;
    if (!data || !Array.isArray(data.samples) || data.samples.length < 6) return null;
    return {
      name: data.name || OWNER_GHOST_NAME,
      carId: data.car_id,
      paintColor: data.paint_color ?? null,
      raceTime: data.race_time,
      dt: data.dt || 0.125,
      samples: data.samples as number[],
    };
  } catch (err) {
    console.warn('[DidaGP] Hayalet okunamadı:', err);
    return null;
  }
}

/**
 * HERKESİN en iyi turu hayalet olur (hub sürümü): buluttaki mevcut hayaletten
 * hızlıysa yükler; hayalet adı = paylaşılan kimlik (Bildim profiles.username).
 * (Eski sürümde yalnızca OWNER_EMAIL hesabı yazabiliyordu — Faz 3'te kaldırıldı.)
 * Sunucudaki süre yükleme anında tekrar okunur (bayat yerel karşılaştırmaya güvenilmez).
 */
export async function uploadGhostIfBest(trackId: string, laps: number, ghost: GhostData): Promise<boolean> {
  if (!supabase) return false;
  try {
    const uid = await userId();
    if (!uid) return false;
    const current = await fetchGhost(trackId, laps);
    if (current && current.raceTime <= ghost.raceTime) return false;
    // Hayalet adı = Bildim'deki paylaşılan kullanıcı adı (yoksa varsayılan)
    let ad = OWNER_GHOST_NAME;
    try {
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
      if (prof?.username) ad = prof.username as string;
    } catch {
      /* isim okunamazsa varsayılan ad kullanılır */
    }
    const { error } = await supabase.from('dg_ghosts').upsert(
      {
        track_id: trackId,
        laps,
        name: ad,
        car_id: ghost.carId,
        paint_color: ghost.paintColor,
        race_time: ghost.raceTime,
        dt: ghost.dt,
        samples: ghost.samples,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'track_id,laps' },
    );
    if (error) throw error;
    console.info(`[DidaGP] Yeni hayalet rekoru yüklendi: ${trackId} ${laps} tur — ${ghost.raceTime.toFixed(3)}s`);
    return true;
  } catch (err) {
    console.warn('[DidaGP] Hayalet buluta yazılamadı:', err);
    return false;
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Supabase yapılandırılmamış');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[DidaGP] Çıkış hatası:', err);
  }
}
