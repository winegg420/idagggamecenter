import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ============================================================
// PatiRun kimlik deposu — HUB SÜRÜMÜ
// Orijinal PatiRun kendi Google-OAuth girişini + kendi `users` tablosunu
// kullanıyordu. IDA GG Game Center'a taşınırken kimlik TAMAMEN Bildim'in
// oturumuna + `profiles` tablosuna bağlandı:
//  - Oturum: Bildim AuthContext (PatiRunApp köprüsü `setBridgedUser` ile besler).
//  - Kullanıcı adı (kimlik): public.profiles.username (paylaşılan, tek profil).
//  - Oyun avatarı (yarış kozmetiği, avatars.ts id'si): pr_users.avatar_id —
//    bu kimlik fotoğrafı DEĞİL, oyuna özgü kozmetik olduğu için oyunda kalır.
// Ayrı giriş/kullanıcı adı seçme ekranı YOK (Faz 4: tek kimlik).
// ============================================================

export interface AuthUser {
  id: string;
  email: string | null;
  /** profiles.username — paylaşılan kimlik adı */
  username: string | null;
  /** PatiRun yarış avatarı (pr_users.avatar_id, avatars.ts id'si) — oyuna özgü */
  avatarId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  /** Bildim köprüsünden gelen oturumla kullanıcıyı ayarlar (PatiRunApp çağırır). */
  setBridgedUser: (u: AuthUser | null) => void;
  /** Kullanıcı adını değiştir → paylaşılan profiles.username (her yerde yansır). */
  setUsername: (username: string) => Promise<boolean>;
  /** Yarış avatarını seç → pr_users.avatar_id (oyuna özgü kozmetik). */
  setAvatar: (avatarId: string) => Promise<void>;
  /** Oyundan çık → hub ana sayfasına dön (Bildim oturumu KAPANMAZ). */
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  setBridgedUser: (u) => set({ user: u, loading: false }),

  setUsername: async (username: string) => {
    const user = get().user;
    if (!user) return false;
    if (!supabase) {
      set({ user: { ...user, username } });
      return true;
    }
    try {
      // Paylaşılan kimlik: profiles.username (Bildim'in isim kurallarıyla birebir).
      const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id);
      if (error) {
        // 23505 = unique ihlali (isim alınmış)
        const alinmis = error.code === '23505' || error.message.toLowerCase().includes('duplicate');
        set({ error: alinmis ? 'Bu kullanıcı adı alınmış' : error.message });
        return false;
      }
      // Oyun tablosundaki kopyayı da senkronla (leaderboard/arkadaş join'leri için)
      try {
        await supabase.from('pr_users').update({ username }).eq('id', user.id);
      } catch {
        // pr_users henüz yoksa sorun değil — köprü girişte oluşturur
      }
      set({ user: { ...user, username }, error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Kullanıcı adı kaydedilemedi' });
      return false;
    }
  },

  setAvatar: async (avatarId: string) => {
    const user = get().user;
    if (!user) return;
    set({ user: { ...user, avatarId } });
    try {
      localStorage.setItem('patirun.avatar', avatarId);
    } catch {
      // depolama kapalıysa geç
    }
    if (supabase) {
      try {
        await supabase.from('pr_users').update({ avatar_id: avatarId }).eq('id', user.id);
      } catch {
        // migration eksik olabilir — yerel seçim korunur
      }
    }
  },

  signOut: () => {
    // Oyundan çıkış = hub'a dönüş. Bildim oturumu tek kimlik olduğu için kapanmaz.
    set({ user: null });
    try {
      window.location.assign('/');
    } catch {
      /* yut */
    }
  },
}));
